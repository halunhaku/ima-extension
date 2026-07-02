import assert from "node:assert/strict";
import test from "node:test";

import {
  exchangeRefreshToken,
  publishItem,
  uploadItem,
  waitForUpload
} from "./cws-api.mjs";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("exchangeRefreshToken posts the expected refresh-token form body", async () => {
  const calls = [];
  const accessToken = await exchangeRefreshToken({
    clientId: "client id",
    clientSecret: "client secret",
    refreshToken: "refresh+token",
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ access_token: "access-token" });
    }
  });

  assert.equal(accessToken, "access-token");
  assert.equal(calls.length, 1);
  const [url, init] = calls[0];
  assert.equal(url, "https://oauth2.googleapis.com/token");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["content-type"], "application/x-www-form-urlencoded");
  assert.equal(
    init.body,
    "grant_type=refresh_token&client_id=client+id&client_secret=client+secret&refresh_token=refresh%2Btoken"
  );
});

test("uploadItem puts zip bytes at the encoded item URL with required headers", async () => {
  const zipBytes = new Uint8Array([80, 75, 3, 4]);
  const calls = [];
  const result = await uploadItem({
    itemId: "item/id",
    accessToken: "upload-token",
    zipBytes,
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ uploadState: "SUCCESS" });
    }
  });

  assert.deepEqual(result, { uploadState: "SUCCESS" });
  const [url, init] = calls[0];
  assert.equal(
    url,
    "https://www.googleapis.com/upload/chromewebstore/v1.1/items/item%2Fid?uploadType=media"
  );
  assert.equal(init.method, "PUT");
  assert.equal(init.headers.authorization, "Bearer upload-token");
  assert.equal(init.headers["x-goog-api-version"], "2");
  assert.equal(init.headers["content-type"], "application/zip");
  assert.equal(init.body, zipBytes);
});

test("waitForUpload polls until the upload reports success", async () => {
  const calls = [];
  const result = await waitForUpload({
    itemId: "item",
    accessToken: "token",
    initial: { uploadState: "IN_PROGRESS" },
    intervalMs: 0,
    maxAttempts: 2,
    sleep: async () => undefined,
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ uploadState: "SUCCESS" });
    }
  });

  assert.deepEqual(result, { uploadState: "SUCCESS" });
  assert.equal(calls.length, 1);
});

test("publishItem posts the public default target as JSON", async () => {
  const calls = [];
  const result = await publishItem({
    itemId: "item/id",
    accessToken: "publish-token",
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse({ status: ["OK"] });
    }
  });

  assert.deepEqual(result, { status: ["OK"] });
  const [url, init] = calls[0];
  assert.equal(
    url,
    "https://www.googleapis.com/chromewebstore/v1.1/items/item%2Fid/publish"
  );
  assert.equal(init.method, "POST");
  assert.equal(init.headers.authorization, "Bearer publish-token");
  assert.equal(init.headers["x-goog-api-version"], "2");
  assert.equal(init.headers["content-type"], "application/json");
  assert.equal(init.body, JSON.stringify({ target: "default" }));
});

test("publishItem treats ITEM_PENDING_REVIEW as an accepted publication state", async () => {
  const result = await publishItem({
    itemId: "item/id",
    accessToken: "publish-token",
    fetchImpl: async () =>
      jsonResponse({
        status: ["ITEM_PENDING_REVIEW"],
        statusDetail: [
          "Your extension may require an in-depth review because your item is requesting broad host permissions."
        ]
      })
  });

  assert.deepEqual(result, {
    status: ["ITEM_PENDING_REVIEW"],
    statusDetail: [
      "Your extension may require an in-depth review because your item is requesting broad host permissions."
    ]
  });
});

test("publishItem redacts secrets from non-OK responses", async () => {
  await assert.rejects(
    publishItem({
      itemId: "item",
      accessToken: "publish-sensitive",
      fetchImpl: async () =>
        jsonResponse(
          { status: ["NOT_OK"], statusDetail: ["publish-sensitive should not leak"] },
          200
        )
    }),
    (error) => {
      assert.match(error.message, /Publish item failed: application status/);
      assert.doesNotMatch(error.message, /publish-sensitive/);
      assert.match(error.message, /\*\*\*/);
      return true;
    }
  );
});
