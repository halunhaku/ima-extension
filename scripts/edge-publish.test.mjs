import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { publishPackage } from "./edge-publish.mjs";

test("publishes Edge artifact in order", async () => {
  const artifactPath = path.join(await mkdtemp(path.join(tmpdir(), "ima-edge-")), "extension.zip");
  await writeFile(artifactPath, "zip");
  const calls = [];
  const api = {
    uploadPackage: async () => { calls.push("upload"); return "u"; },
    waitForOperation: async ({ kind }) => calls.push(`wait-${kind}`),
    publishSubmission: async ({ notes }) => { calls.push(notes); return "p"; }
  };
  await publishPackage({
    artifactPath,
    env: { EDGE_PRODUCT_ID: "product", EDGE_CLIENT_ID: "client", EDGE_API_KEY: "key", VERSION: "0.1.5" },
    api,
    log: () => {}
  });
  assert.deepEqual(calls, [
    "upload",
    "wait-upload",
    "Automated Web Clipper for ima update 0.1.5",
    "wait-publish"
  ]);
});

test("requires Edge credentials", async () => {
  await assert.rejects(publishPackage({ artifactPath: "missing.zip", env: {} }), /Missing EDGE_PRODUCT_ID/);
});
