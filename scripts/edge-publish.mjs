import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as edgeApi from "./edge-api.mjs";

export async function publishPackage({ artifactPath, env = process.env, api = edgeApi, log = console.log, timeoutMs = 12 * 60_000 } = {}) {
  for (const name of ["EDGE_PRODUCT_ID", "EDGE_CLIENT_ID", "EDGE_API_KEY"]) {
    if (!String(env[name] ?? "").trim()) throw new Error(`Missing ${name}.`);
  }
  if (!artifactPath) throw new Error("Artifact path is required.");

  const { EDGE_PRODUCT_ID: productId, EDGE_CLIENT_ID: clientId, EDGE_API_KEY: apiKey } = env;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Edge Add-ons publication timed out after ${timeoutMs}ms.`)),
    timeoutMs
  );

  try {
    const metadata = await stat(artifactPath);
    if (!metadata.isFile()) throw new Error("Artifact is not an accessible file.");
    const uploadId = await api.uploadPackage({
      productId,
      clientId,
      apiKey,
      zipBytes: await readFile(artifactPath),
      signal: controller.signal
    });
    log("Edge Add-ons upload started.");
    await api.waitForOperation({ productId, clientId, apiKey, operationId: uploadId, kind: "upload", signal: controller.signal });
    log("Edge Add-ons upload completed.");
    const publishId = await api.publishSubmission({
      productId,
      clientId,
      apiKey,
      notes: `Automated Web Clipper for ima update ${env.VERSION || ""}`.trim(),
      signal: controller.signal
    });
    await api.waitForOperation({ productId, clientId, apiKey, operationId: publishId, kind: "publish", signal: controller.signal });
    log("Edge Add-ons public review submission accepted.");
  } finally {
    clearTimeout(timer);
  }
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  publishPackage({ artifactPath: process.argv[2] }).catch((error) => {
    console.error(error?.message ?? "Edge Add-ons publication failed.");
    process.exitCode = 1;
  });
}
