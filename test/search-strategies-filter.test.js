"use strict";

const assert = require("assert");
const { test } = require("node:test");
const { basicFilter, chunkTypeFilter, combineFilters, mergeWeighted } = require("../src/retrieval/search-strategies");

test("chunkTypeFilter builds should clauses", () => {
  const f = chunkTypeFilter(["pseudocode_flow", "pseudocode_validations_rules"]);
  assert.ok(f && Array.isArray(f.should));
  assert.equal(f.should.length, 2);
});

test("combineFilters merges filters and mergeWeighted is stable", () => {
  const f1 = basicFilter("ANMELD");
  const f2 = chunkTypeFilter(["text"]);
  const c = combineFilters(f1, f2);
  assert.ok(c.should && c.should.length >= 2);
  const a = [{ id: 1, score: 0.2 }];
  const b = [{ id: 1, score: 0.8 }];
  const m = mergeWeighted(a, b, 0.5);
  assert.equal(m.length, 1);
  assert.ok(typeof m[0].score === "number" && m[0].score >= 0);
});
