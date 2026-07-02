import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageScript = path.join(root, "scripts", "package-release.mjs");

const fixtureEntries = [
  ["dist/index.html", "<main>popup</main>"],
  ["dist/assets/content.js", "console.log('content');"],
  ["dist/assets/popup.js", "console.log('popup');"],
  ["dist/assets/popup.css", "body{}"],
  ["dist/assets/serviceWorker.js", "console.log('sw');"],
  ["dist/assets/chunk.js", "console.log('chunk');"],
  ["dist/manifest.json", JSON.stringify({ manifest_version: 3, version: "9.8.7" })]
];

async function writeFixture(fixtureRoot, entries, mtime) {
  for (const [entry, contents] of entries) {
    const sourcePath = path.join(fixtureRoot, ...entry.split("/"));
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, contents);
    await utimes(sourcePath, mtime, mtime);
  }
}

async function packageFixture(fixtureRoot, extraEnv = {}) {
  await execFileAsync(process.execPath, [packageScript], {
    cwd: fixtureRoot,
    env: { ...process.env, npm_package_version: "9.8.7", ...extraEnv }
  });
  return path.join(fixtureRoot, "dist", "web-clipper-for-ima-9.8.7.zip");
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function listZipEntries(file, cwd) {
  if (process.platform !== "win32") {
    const { stdout } = await execFileAsync("unzip", ["-Z1", file], { cwd });
    return stdout.trim().split(/\r?\n/).filter(Boolean);
  }

  const command = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    $zip = [IO.Compression.ZipFile]::OpenRead('${file.replaceAll("'", "''")}');
    try { $zip.Entries | ForEach-Object { $_.FullName } }
    finally { $zip.Dispose() }
  `;
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command
  ], { cwd });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

test("release package is byte-for-byte reproducible with sorted entries", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ima-package-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  await writeFixture(fixtureRoot, fixtureEntries, new Date("2024-01-02T03:04:05Z"));
  const firstZip = await packageFixture(fixtureRoot);
  const firstHash = await sha256(firstZip);

  await rm(path.join(fixtureRoot, "dist"), { recursive: true, force: true });
  await writeFixture(
    fixtureRoot,
    [...fixtureEntries].reverse(),
    new Date("2025-06-07T08:09:10Z")
  );
  const secondZip = await packageFixture(fixtureRoot);
  const secondHash = await sha256(secondZip);
  const entries = await listZipEntries(secondZip, fixtureRoot);

  assert.equal(secondHash, firstHash);
  assert.deepEqual(entries, [...entries].sort((a, b) => a.localeCompare(b, "en")));
});

test("release package rejects malformed SOURCE_DATE_EPOCH", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ima-package-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeFixture(fixtureRoot, fixtureEntries, new Date("2024-01-02T03:04:05Z"));

  await assert.rejects(
    packageFixture(fixtureRoot, { SOURCE_DATE_EPOCH: "not-a-timestamp" }),
    (error) => {
      assert.match(error.stderr, /SOURCE_DATE_EPOCH must be a finite nonnegative integer/);
      return true;
    }
  );
});

test("release package rejects a dist manifest version mismatch", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "ima-package-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await writeFixture(
    fixtureRoot,
    fixtureEntries.map(([entry, contents]) =>
      entry === "dist/manifest.json"
        ? [entry, JSON.stringify({ manifest_version: 3, version: "0.0.1" })]
        : [entry, contents]
    ),
    new Date("2024-01-02T03:04:05Z")
  );

  await assert.rejects(
    packageFixture(fixtureRoot),
    (error) => {
      assert.match(error.stderr, /dist\/manifest\.json version \(0.0.1\) must match package version \(9.8.7\)/);
      return true;
    }
  );
});
