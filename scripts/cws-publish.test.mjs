import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { publishPackage } from "./cws-publish.mjs";

const completeEnv = {
  CWS_CLIENT_ID: "client-id-secret-value",
  CWS_CLIENT_SECRET: "client-secret-value",
  CWS_REFRESH_TOKEN: "refresh-token-value",
  CWS_ITEM_ID: "item-id-value"
};

function recordingApi(calls = []) {
  return {
    async exchangeRefreshToken(input) {
      calls.push(["exchangeRefreshToken", input]);
      return "access-token-value";
    },
    async uploadItem(input) {
      calls.push(["uploadItem", input]);
      return { uploadState: "IN_PROGRESS" };
    },
    async waitForUpload(input) {
      calls.push(["waitForUpload", input]);
      return { uploadState: "SUCCESS" };
    },
    async publishItem(input) {
      calls.push(["publishItem", input]);
      return { status: ["OK"] };
    }
  };
}

test("publishPackage requires every Chrome Web Store secret", async () => {
  for (const name of [
    "CWS_CLIENT_ID",
    "CWS_CLIENT_SECRET",
    "CWS_REFRESH_TOKEN",
    "CWS_ITEM_ID"
  ]) {
    await assert.rejects(
      publishPackage({
        artifactPath: "missing.zip",
        env: { ...completeEnv, [name]: " " },
        api: recordingApi()
      }),
      new Error(`Missing ${name}.`)
    );
  }
});

test("publishPackage rejects missing artifacts", async () => {
  await assert.rejects(
    publishPackage({
      artifactPath: "definitely-does-not-exist.zip",
      env: completeEnv,
      api: recordingApi()
    }),
    new Error("Artifact is not an accessible file.")
  );
});

test("publishPackage redacts secrets from failures", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ima-cws-publish-"));
  const artifactPath = path.join(directory, "ima.zip");
  await writeFile(artifactPath, "zip");

  try {
    await assert.rejects(
      publishPackage({
        artifactPath,
        env: completeEnv,
        api: {
          async exchangeRefreshToken() {
            throw new Error(
              `Token exchange rejected client ${completeEnv.CWS_CLIENT_ID}, secret ${completeEnv.CWS_CLIENT_SECRET}, refresh ${completeEnv.CWS_REFRESH_TOKEN}, item ${completeEnv.CWS_ITEM_ID}.`
            );
          }
        }
      }),
      (error) => {
        assert.match(error.message, /Token exchange rejected client/);
        for (const secret of Object.values(completeEnv)) {
          assert.doesNotMatch(error.message, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        assert.match(error.message, /\*\*\*/);
        return true;
      }
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("exchanges, uploads, waits, and publishes in order with safe logs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ima-cws-publish-"));
  const artifactPath = path.join(directory, "ima.zip");
  await writeFile(artifactPath, "zip");
  const calls = [];
  const logs = [];

  try {
    const result = await publishPackage({
      artifactPath,
      env: completeEnv,
      api: recordingApi(calls),
      log: (message) => logs.push(message)
    });

    assert.deepEqual(result, { status: ["OK"] });
    assert.deepEqual(
      calls.map(([name]) => name),
      ["exchangeRefreshToken", "uploadItem", "waitForUpload", "publishItem"]
    );
    assert.deepEqual(logs, [
      "Chrome Web Store authentication completed.",
      "Chrome Web Store upload started.",
      "Chrome Web Store upload completed.",
      "Chrome Web Store public review submission accepted."
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
