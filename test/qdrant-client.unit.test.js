"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { QdrantClient } = require("../src/retrieval/qdrant-client");

test("QdrantClient searchPoints calls POST and returns result", async () => {
  const mock = {
    post: async (url, body) => {
      assert.equal(url.includes("/points/search"), true);
      assert.ok(Array.isArray(body.vector));
      return { data: { result: [{ id: 1, score: 0.9, payload: { content: "x" } }] } };
    },
  };
  const qc = new QdrantClient({ http: mock, url: "http://local" });
  const res = await qc.searchPoints("col", [0.1, 0.2], { limit: 1, with_payload: true });
  assert.equal(Array.isArray(res), true);
  assert.equal(res[0].id, 1);
});
