const API_ROOT = "https://api.addons.microsoftedge.microsoft.com";
const REQUEST_TIMEOUT_MS = 60_000;

function safe(value, secrets) {
  let result = String(value);
  for (const secret of secrets.filter(Boolean).map(String).sort((a, b) => b.length - a.length)) {
    result = result.replaceAll(secret, "***");
  }
  return result;
}

function authHeaders(clientId, apiKey, extra = {}) {
  return { authorization: `ApiKey ${apiKey}`, "x-clientid": clientId, ...extra };
}

function url(productId, suffix) {
  return `${API_ROOT}/v1/products/${encodeURIComponent(productId)}${suffix}`;
}

async function request({ action, url: target, init, fetchImpl, secrets, expectedStatus, signal }) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason instanceof Error ? signal.reason : new Error(`${action} was aborted.`));
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(`${action} timed out.`)), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(target, { ...init, signal: controller.signal });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (response.status !== expectedStatus) {
      throw new Error(`${action} failed (HTTP ${response.status}): ${safe(JSON.stringify(data), secrets)}`);
    }
    return { data, location: response.headers.get("location") };
  } catch (error) {
    const reason = controller.signal.aborted ? controller.signal.reason : error;
    const message = safe(reason?.message ?? reason, secrets);
    throw new Error(message.startsWith(action) ? message : `${action} failed: ${message}`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function operationId(location, action) {
  const id = location?.split("/").filter(Boolean).at(-1);
  if (!id) throw new Error(`${action} failed: missing Location operation ID.`);
  return id;
}

export async function uploadPackage({ productId, clientId, apiKey, zipBytes, fetchImpl = fetch, signal }) {
  const result = await request({
    action: "Edge package upload",
    url: url(productId, "/submissions/draft/package"),
    init: {
      method: "POST",
      headers: authHeaders(clientId, apiKey, { "content-type": "application/zip" }),
      body: zipBytes
    },
    fetchImpl,
    secrets: [clientId, apiKey],
    expectedStatus: 202,
    signal
  });
  return operationId(result.location, "Edge package upload");
}

export async function publishSubmission({ productId, clientId, apiKey, notes, fetchImpl = fetch, signal }) {
  const result = await request({
    action: "Edge review submission",
    url: url(productId, "/submissions"),
    init: {
      method: "POST",
      headers: authHeaders(clientId, apiKey, { "content-type": "application/json" }),
      body: JSON.stringify({ notes })
    },
    fetchImpl,
    secrets: [clientId, apiKey],
    expectedStatus: 202,
    signal
  });
  return operationId(result.location, "Edge review submission");
}

export async function getOperation({ productId, clientId, apiKey, operationId, kind, fetchImpl = fetch, signal }) {
  const suffix = kind === "upload"
    ? `/submissions/draft/package/operations/${encodeURIComponent(operationId)}`
    : `/submissions/operations/${encodeURIComponent(operationId)}`;
  return (await request({
    action: `Edge ${kind} status`,
    url: url(productId, suffix),
    init: { method: "GET", headers: authHeaders(clientId, apiKey) },
    fetchImpl,
    secrets: [clientId, apiKey],
    expectedStatus: 200,
    signal
  })).data;
}

export async function waitForOperation({ productId, clientId, apiKey, operationId, kind, fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), maxAttempts = 60, intervalMs = 5000, signal }) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await getOperation({ productId, clientId, apiKey, operationId, kind, fetchImpl, signal });
    if (result?.status === "Succeeded") return result;
    if (result?.status === "Failed") {
      throw new Error(`Edge ${kind} failed: ${JSON.stringify({ message: result.message, errorCode: result.errorCode, errors: result.errors })}`);
    }
    if (result?.status !== "InProgress") {
      throw new Error(`Edge ${kind} returned unexpected status: ${result?.status ?? "missing"}`);
    }
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error(`Edge ${kind} did not complete after ${maxAttempts} attempts.`);
}
