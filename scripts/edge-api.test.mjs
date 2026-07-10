import assert from "node:assert/strict";
import test from "node:test";
import { publishSubmission, uploadPackage, waitForOperation } from "./edge-api.mjs";

const response = (status, data = null, location = null) => new Response(
  data === null ? "" : JSON.stringify(data),
  { status, headers: location ? { location } : {} }
);

test("uploads with Edge v1.1 credentials", async () => {
  let request;
  const id = await uploadPackage({
    productId: "product",
    clientId: "client",
    apiKey: "key",
    zipBytes: Buffer.from("zip"),
    fetchImpl: async (target, init) => {
      request = { target, init };
      return response(202, null, "operation-1");
    }
  });
  assert.equal(id, "operation-1");
  assert.equal(request.init.headers.authorization, "ApiKey key");
  assert.equal(request.init.headers["x-clientid"], "client");
});

test("submits certification notes", async () => {
  let body;
  const id = await publishSubmission({
    productId: "product",
    clientId: "client",
    apiKey: "key",
    notes: "Web Clipper for ima 0.1.5",
    fetchImpl: async (_target, init) => {
      body = init.body;
      return response(202, null, "/operations/publish-1");
    }
  });
  assert.equal(id, "publish-1");
  assert.deepEqual(JSON.parse(body), { notes: "Web Clipper for ima 0.1.5" });
});

test("polls to success and exposes terminal failures", async () => {
  const states = ["InProgress", "Succeeded"];
  const result = await waitForOperation({
    productId: "p",
    clientId: "c",
    apiKey: "k",
    operationId: "o",
    kind: "upload",
    fetchImpl: async () => response(200, { status: states.shift() }),
    sleep: async () => {},
    intervalMs: 0
  });
  assert.equal(result.status, "Succeeded");
  await assert.rejects(
    waitForOperation({
      productId: "p",
      clientId: "c",
      apiKey: "k",
      operationId: "o",
      kind: "publish",
      fetchImpl: async () => response(200, { status: "Failed", errorCode: "NoModulesUpdated" })
    }),
    /NoModulesUpdated/
  );
});
