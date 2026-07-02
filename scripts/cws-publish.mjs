import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import * as cwsApi from "./cws-api.mjs";

const REQUIRED_ENV = [
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
  "CWS_ITEM_ID"
];

function safeError(error, secrets) {
  let message = String(error?.message ?? error);
  for (const secret of secrets.filter(Boolean).map(String).sort((a, b) => b.length - a.length)) {
    message = message.replaceAll(secret, "***");
  }
  return new Error(message);
}

async function readArtifact(artifactPath) {
  try {
    const metadata = await stat(artifactPath);
    if (!metadata.isFile()) {
      throw new Error("not a file");
    }

    return await readFile(artifactPath);
  } catch {
    throw new Error("Artifact is not an accessible file.");
  }
}

export async function publishPackage({
  artifactPath,
  env = process.env,
  api = cwsApi,
  log = console.log,
  timeoutMs = 10 * 60_000
} = {}) {
  for (const name of REQUIRED_ENV) {
    if (!String(env[name] ?? "").trim()) {
      throw new Error(`Missing ${name}.`);
    }
  }

  if (!artifactPath) {
    throw new Error("Artifact path is required.");
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive number.");
  }

  const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_ITEM_ID } = env;
  const secrets = [CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_ITEM_ID];
  let accessToken;
  const controller = new AbortController();
  let timer;

  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`Chrome Web Store publication timed out after ${timeoutMs}ms.`);
        controller.abort(error);
        reject(error);
      }, timeoutMs);
    });

    const publication = (async () => {
      const zipBytes = await readArtifact(artifactPath);
      accessToken = await api.exchangeRefreshToken({
        clientId: CWS_CLIENT_ID,
        clientSecret: CWS_CLIENT_SECRET,
        refreshToken: CWS_REFRESH_TOKEN,
        signal: controller.signal
      });
      log("Chrome Web Store authentication completed.");

      const initial = await api.uploadItem({
        itemId: CWS_ITEM_ID,
        accessToken,
        zipBytes,
        signal: controller.signal
      });
      log("Chrome Web Store upload started.");

      await api.waitForUpload({
        itemId: CWS_ITEM_ID,
        accessToken,
        initial,
        signal: controller.signal
      });
      log("Chrome Web Store upload completed.");

      const result = await api.publishItem({
        itemId: CWS_ITEM_ID,
        accessToken,
        signal: controller.signal
      });
      log("Chrome Web Store public review submission accepted.");
      return result;
    })();

    return await Promise.race([publication, deadline]);
  } catch (error) {
    throw safeError(error, [...secrets, accessToken]);
  } finally {
    clearTimeout(timer);
  }
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  publishPackage({ artifactPath: process.argv[2] }).catch((error) => {
    console.error(error?.message ?? "Chrome Web Store publication failed.");
    process.exitCode = 1;
  });
}
