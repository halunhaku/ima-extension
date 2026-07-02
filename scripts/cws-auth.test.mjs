import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import {
  buildAuthorizationUrl,
  openBrowser,
  parseOAuthCallback,
  storeRefreshToken
} from "./cws-auth.mjs";

test("buildAuthorizationUrl includes offline Chrome Web Store consent parameters", () => {
  const url = new URL(
    buildAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "http://127.0.0.1:8765/callback",
      state: "state-token"
    })
  );

  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:8765/callback");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/chromewebstore");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "state-token");
});

test("parseOAuthCallback validates path, state, and code", () => {
  assert.equal(
    parseOAuthCallback("http://127.0.0.1:8765/callback?state=abc&code=xyz", "abc"),
    "xyz"
  );
  assert.throws(
    () => parseOAuthCallback("http://127.0.0.1:8765/other?state=abc&code=xyz", "abc"),
    /Unexpected OAuth callback path/
  );
  assert.throws(
    () => parseOAuthCallback("http://127.0.0.1:8765/callback?state=nope&code=xyz", "abc"),
    /OAuth state mismatch/
  );
});

test("storeRefreshToken writes the token to gh secret set", async () => {
  const writes = [];
  await storeRefreshToken("refresh-secret", {
    runGh(_command, args) {
      const child = new EventEmitter();
      child.stdin = new EventEmitter();
      child.stdin.end = (value) => {
        writes.push({ args, value });
        process.nextTick(() => child.emit("close", 0));
      };
      child.kill = () => undefined;
      child.once = child.on.bind(child);
      return child;
    }
  });

  assert.deepEqual(writes, [
    {
      args: ["secret", "set", "CWS_REFRESH_TOKEN"],
      value: "refresh-secret"
    }
  ]);
});

test("openBrowser chooses the platform launcher", async () => {
  const calls = [];
  await openBrowser("https://example.com", {
    platform: "darwin",
    run(command, args, _options, callback) {
      calls.push([command, args]);
      callback(null);
    }
  });

  assert.deepEqual(calls, [["open", ["https://example.com"]]]);
});
