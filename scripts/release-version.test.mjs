import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { validateReleaseVersion } from "./release-version.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "release-version.mjs");

async function createVersionRoot(t, packageVersion, manifestVersion) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ima-release-version-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: packageVersion }));
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({ version: manifestVersion }));
  return root;
}

test("returns the release version when tag, package, and manifest match", async (t) => {
  const root = await createVersionRoot(t, "0.2.1", "0.2.1");
  assert.equal(await validateReleaseVersion({ root, tag: "v0.2.1" }), "0.2.1");
});

test("rejects malformed release tags", async (t) => {
  const root = await createVersionRoot(t, "0.2.1", "0.2.1");
  await assert.rejects(
    validateReleaseVersion({ root, tag: "0.2.1" }),
    new Error("Tag must match vX.Y.Z.")
  );
});

test("reports all versions when release versions differ", async (t) => {
  const root = await createVersionRoot(t, "0.2.0", "0.2.1");
  await assert.rejects(
    validateReleaseVersion({ root, tag: "v0.2.2" }),
    new Error("Version mismatch: tag=0.2.2 package=0.2.0 manifest=0.2.1")
  );
});

test("CLI prints a matching release version", async (t) => {
  const root = await createVersionRoot(t, "0.2.1", "0.2.1");
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, "v0.2.1"], {
    cwd: root
  });

  assert.equal(stdout, "0.2.1\n");
  assert.equal(stderr, "");
});

test("CLI prints validation errors and exits with code 1", async (t) => {
  const root = await createVersionRoot(t, "0.2.1", "0.2.1");
  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath, "release-0.2.1"], { cwd: root }),
    (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, "Tag must match vX.Y.Z.\n");
      return true;
    }
  );
});
