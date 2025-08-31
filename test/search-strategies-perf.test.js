"use strict";

const assert = require("assert");
const { test } = require("node:test");
const { mergeWeighted } = require("../src/retrieval/search-strategies");

test("mergeWeighted handles large arrays quickly (gated)", () => {
  if (String(process.env.SEARCH_PERF || "").toLowerCase() !== "true") {
    return; // skip unless explicitly enabled
  }
  const n = 10000;
  const a = Array.from({ length: n }, (_, i) => ({ id: i, score: Math.random() }));
  const b = Array.from({ length: n }, (_, i) => ({ id: i, score: Math.random() }));
  const start = Date.now();
  const res = mergeWeighted(a, b, 0.5);
  const dur = Date.now() - start;
  assert.equal(res.length, n);
  // heuristic threshold; adjust if needed
  assert.ok(dur < 500, `merge too slow: ${dur}ms`);
});
