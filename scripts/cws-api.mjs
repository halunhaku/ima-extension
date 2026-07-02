const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STORE_API_ROOT = "https://www.googleapis.com/chromewebstore/v1.1/items";
const STORE_UPLOAD_ROOT = "https://www.googleapis.com/upload/chromewebstore/v1.1/items";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

function normalizedSecrets(secrets) {
  return [...new Set(secrets.filter(Boolean).map(String))].sort(
    (left, right) => right.length - left.length
  );
}

function redact(value, secrets) {
  let result = String(value);
  for (const secret of normalizedSecrets(secrets)) {
    result = result.replaceAll(secret, "***");
  }
  return result;
}

function redactJson(value, secrets) {
  if (typeof value === "string") {
    return redact(value, secrets);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, secrets));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [redact(key, secrets), redactJson(item, secrets)])
    );
  }

  return value;
}

function validateTimeout(milliseconds, name) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
}

async function requestJson({
  action,
  url,
  init,
  fetchImpl,
  secrets = [],
  signal,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  validateTimeout(requestTimeoutMs, "requestTimeoutMs");
  const controller = new AbortController();
  let timer;
  let removeExternalAbort = () => {};

  const operation = (async () => {
    let response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw controller.signal.reason;
      }

      throw new Error(`${action} failed: ${redact(error?.message ?? error, secrets)}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${action} failed (HTTP ${response.status}): malformed JSON`);
    }

    if (!response.ok) {
      throw new Error(
        `${action} failed (HTTP ${response.status}): ${JSON.stringify(redactJson(data, secrets))}`
      );
    }

    return data;
  })();

  const requestTimeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${action} timed out after ${requestTimeoutMs}ms.`);
      controller.abort(error);
      reject(error);
    }, requestTimeoutMs);
  });

  const externalAbort = new Promise((_, reject) => {
    if (!signal) {
      return;
    }

    const abort = () => {
      const reason =
        signal.reason instanceof Error ? signal.reason : new Error(`${action} was aborted.`);
      controller.abort(reason);
      reject(reason);
    };

    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener("abort", abort, { once: true });
      removeExternalAbort = () => signal.removeEventListener("abort", abort);
    }
  });

  try {
    return await Promise.race([operation, requestTimeout, externalAbort]);
  } catch (error) {
    const message = redact(error?.message ?? error, secrets);
    throw new Error(message.startsWith(action) ? message : `${action} failed: ${message}`);
  } finally {
    clearTimeout(timer);
    removeExternalAbort();
  }
}

function itemUrl(root, itemId, suffix = "") {
  return `${root}/${encodeURIComponent(itemId)}${suffix}`;
}

function apiHeaders(accessToken, extra = {}) {
  return {
    authorization: `Bearer ${accessToken}`,
    "x-goog-api-version": "2",
    ...extra
  };
}

export async function exchangeRefreshToken({
  clientId,
  clientSecret,
  refreshToken,
  fetchImpl = fetch,
  signal,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  const secrets = [clientId, clientSecret, refreshToken];
  const data = await requestJson({
    action: "Token exchange",
    url: TOKEN_URL,
    init: {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      }).toString()
    },
    fetchImpl,
    secrets,
    signal,
    requestTimeoutMs
  });

  if (!data.access_token) {
    throw new Error("Token exchange failed: missing access_token");
  }

  return data.access_token;
}

export function uploadItem({
  itemId,
  accessToken,
  zipBytes,
  fetchImpl = fetch,
  signal,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  return requestJson({
    action: "Upload item",
    url: itemUrl(STORE_UPLOAD_ROOT, itemId, "?uploadType=media"),
    init: {
      method: "PUT",
      headers: apiHeaders(accessToken, { "content-type": "application/zip" }),
      body: zipBytes
    },
    fetchImpl,
    secrets: [accessToken],
    signal,
    requestTimeoutMs
  });
}

export function getItemStatus({
  itemId,
  accessToken,
  fetchImpl = fetch,
  signal,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  return requestJson({
    action: "Get item status",
    url: itemUrl(STORE_API_ROOT, itemId, "?projection=DRAFT"),
    init: {
      method: "GET",
      headers: apiHeaders(accessToken)
    },
    fetchImpl,
    secrets: [accessToken],
    signal,
    requestTimeoutMs
  });
}

function inspectUploadState(result) {
  const state = result?.uploadState;
  if (!state) {
    throw new Error("Upload response has missing state");
  }

  if (state === "SUCCESS") {
    return "success";
  }

  if (state === "IN_PROGRESS") {
    return "pending";
  }

  if (state === "FAILURE" || state === "NOT_FOUND") {
    throw new Error(`Upload reached terminal state ${state}`);
  }

  throw new Error(`Upload response has unexpected state ${state}`);
}

function defaultSleep(milliseconds, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const timer = setTimeout(() => finish(), milliseconds);
    const abort = () => {
      finish(signal.reason instanceof Error ? signal.reason : new Error("Upload polling aborted."));
    };

    if (!signal) {
      return;
    }

    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener("abort", abort, { once: true });
    }
  });
}

function publishOutcomeError(reason, data, accessToken) {
  const detail = redactJson(
    { status: data?.status, statusDetail: data?.statusDetail },
    [accessToken]
  );
  return new Error(`Publish item failed: ${reason} ${JSON.stringify(detail)}`);
}

export async function waitForUpload({
  itemId,
  accessToken,
  initial,
  fetchImpl = fetch,
  sleep = defaultSleep,
  maxAttempts = 30,
  intervalMs = 5000,
  signal,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  let current = initial;
  if (inspectUploadState(current) === "success") {
    return current;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw signal.reason;
    }

    await sleep(intervalMs, { signal });
    if (signal?.aborted) {
      throw signal.reason;
    }

    current = await getItemStatus({
      itemId,
      accessToken,
      fetchImpl,
      signal,
      requestTimeoutMs
    });
    if (inspectUploadState(current) === "success") {
      return current;
    }
  }

  throw new Error(`Upload timed out after ${maxAttempts} status checks`);
}

export async function publishItem({
  itemId,
  accessToken,
  fetchImpl = fetch,
  signal,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  const data = await requestJson({
    action: "Publish item",
    url: itemUrl(STORE_API_ROOT, itemId, "/publish"),
    init: {
      method: "POST",
      headers: apiHeaders(accessToken, { "content-type": "application/json" }),
      body: JSON.stringify({ target: "default" })
    },
    fetchImpl,
    secrets: [accessToken],
    signal,
    requestTimeoutMs
  });

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw publishOutcomeError("malformed response", data, accessToken);
  }

  if (!Object.hasOwn(data, "status")) {
    throw publishOutcomeError("missing application status", data, accessToken);
  }

  if (
    !Array.isArray(data.status) ||
    data.status.length === 0 ||
    data.status.some((status) => typeof status !== "string")
  ) {
    throw publishOutcomeError("malformed application status", data, accessToken);
  }

  if (data.status.some((status) => status !== "OK")) {
    throw publishOutcomeError("application status", data, accessToken);
  }

  return data;
}
