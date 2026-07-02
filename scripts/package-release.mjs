import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PACKAGE_PREFIX = "web-clipper-for-ima";
const REQUIRED_DIST_FILES = [
  "manifest.json",
  "index.html",
  "assets/content.js",
  "assets/popup.js",
  "assets/popup.css",
  "assets/serviceWorker.js"
];
const defaultArchiveEpoch = Date.UTC(1980, 0, 1) / 1000;
const maximumArchiveEpoch = Date.UTC(2107, 11, 31, 23, 59, 58) / 1000;

function resolveArchiveDate() {
  const rawEpoch = process.env.SOURCE_DATE_EPOCH;
  if (rawEpoch === undefined) {
    return new Date(defaultArchiveEpoch * 1000);
  }

  const epoch = rawEpoch.trim() === "" ? Number.NaN : Number(rawEpoch);
  if (!Number.isFinite(epoch) || !Number.isInteger(epoch) || epoch < 0) {
    throw new Error("SOURCE_DATE_EPOCH must be a finite nonnegative integer.");
  }

  const zipEpoch = Math.min(maximumArchiveEpoch, Math.max(defaultArchiveEpoch, epoch));
  return new Date(zipEpoch * 1000);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

async function collectFiles(rootDir, relativePath = "") {
  const directory = path.join(rootDir, relativePath);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (/^web-clipper-for-ima-\d+\.\d+\.\d+\.zip$/.test(entry.name)) {
      continue;
    }

    const childRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, childRelativePath)));
    } else if (entry.isFile()) {
      files.push(childRelativePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right, "en"));
}

async function ensureDistShape({ distDir, version }) {
  for (const file of REQUIRED_DIST_FILES) {
    try {
      const metadata = await stat(path.join(distDir, file));
      if (!metadata.isFile()) {
        throw new Error("not a file");
      }
    } catch {
      throw new Error(`Missing packaged runtime file: dist/${file}`);
    }
  }

  const manifest = JSON.parse(await readFile(path.join(distDir, "manifest.json"), "utf8"));
  if (manifest.version !== version) {
    throw new Error(
      `dist/manifest.json version (${manifest.version}) must match package version (${version}).`
    );
  }
}

export async function packageRelease({ root = process.cwd(), version = process.env.npm_package_version } = {}) {
  if (!String(version ?? "").trim()) {
    throw new Error("npm_package_version is required.");
  }

  const distDir = path.resolve(root, "dist");
  const zipPath = path.join(distDir, `${PACKAGE_PREFIX}-${version}.zip`);
  const archiveDate = resolveArchiveDate();

  await ensureDistShape({ distDir, version });

  const archiveEntries = await collectFiles(distDir);

  for (const file of await readdir(distDir)) {
    if (/^web-clipper-for-ima-\d+\.\d+\.\d+\.zip$/.test(file)) {
      await rm(path.join(distDir, file), { force: true });
    }
  }

  if (process.platform === "win32") {
    const command = `
      Add-Type -AssemblyName System.IO.Compression;
      Add-Type -AssemblyName System.IO.Compression.FileSystem;
      $items = $env:IMA_PACKAGE_ENTRIES | ConvertFrom-Json;
      $timestamp = [DateTimeOffset]::Parse(
        $env:IMA_PACKAGE_TIMESTAMP,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
      );
      $zip = [IO.Compression.ZipFile]::Open(
        $env:IMA_PACKAGE_DESTINATION,
        [IO.Compression.ZipArchiveMode]::Create
      );
      try {
        $root = (Get-Location).Path;
        foreach ($item in $items) {
          $sourcePath = [IO.Path]::GetFullPath((Join-Path $root $item.source));
          $entry = $zip.CreateEntry($item.entry, [IO.Compression.CompressionLevel]::Optimal);
          $entry.LastWriteTime = $timestamp;
          $source = [IO.File]::OpenRead($sourcePath);
          $destination = $entry.Open();
          try {
            $source.CopyTo($destination);
          } finally {
            $destination.Dispose();
            $source.Dispose();
          }
        }
      } finally {
        if ($zip) { $zip.Dispose(); }
      }
    `;
    const entriesJson = JSON.stringify(
      archiveEntries.map((entry) => ({
        source: entry.split("/").join(path.sep),
        entry
      }))
    );

    await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      cwd: distDir,
      env: {
        ...process.env,
        IMA_PACKAGE_DESTINATION: zipPath,
        IMA_PACKAGE_ENTRIES: entriesJson,
        IMA_PACKAGE_TIMESTAMP: archiveDate.toISOString()
      }
    });
  } else {
    const stagingDir = await mkdtemp(path.join(os.tmpdir(), "ima-extension-package-"));
    try {
      for (const entry of archiveEntries) {
        const stagedPath = path.join(stagingDir, ...entry.split("/"));
        await mkdir(path.dirname(stagedPath), { recursive: true });
        await copyFile(path.join(distDir, ...entry.split("/")), stagedPath);
        await utimes(stagedPath, archiveDate, archiveDate);
      }

      await run("zip", ["-X", zipPath, ...archiveEntries], {
        cwd: stagingDir,
        env: { ...process.env, TZ: "UTC" }
      });
    } finally {
      await rm(stagingDir, { recursive: true, force: true });
    }
  }

  console.log(`Created ${path.relative(root, zipPath)}`);
  return zipPath;
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  packageRelease().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
