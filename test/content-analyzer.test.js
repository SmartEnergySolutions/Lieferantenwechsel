"use strict";

const assert = require("assert");
const { test } = require("node:test");
const {
  filterByChunkTypes,
  dedupeByIdOrSource,
  scoreRelevance,
  sortByRelevance,
  selectTop,
} = require("../src/retrieval/content-analyzer");

test("content-analyzer filters, dedupes, scores, sorts, and selects", () => {
  const items = [
    { id: 1, score: 0.1, payload: { chunk_type: "pseudocode_flow", content: "ANMELD Nachricht Beispiel" } },
    { id: 1, score: 0.2, payload: { chunk_type: "pseudocode_flow", content: "ANMELD Nachricht Beispiel" } }, // duplicate id
    { id: 2, score: 0.05, payload: { chunk_type: "text", content: "Allgemeine Beschreibung" } },
    { id: 3, score: 0.4, payload: { chunk_type: "pseudocode_validations_rules", content: "ALOCAT Regeln und Fristen" } },
  ];

  const filtered = filterByChunkTypes(items, ["pseudocode_flow", "pseudocode_validations_rules"]);
  assert.equal(filtered.length, 3);

  const deduped = dedupeByIdOrSource(filtered);
  assert.equal(deduped.length, 2);

  const scored1 = scoreRelevance(deduped[0], { priorityChunkTypes: ["pseudocode_flow"], keywords: ["ANMELD"] });
  const scored2 = scoreRelevance(deduped[1], { priorityChunkTypes: ["pseudocode_flow"], keywords: ["ANMELD"] });
  assert.ok(typeof scored1 === "number" && typeof scored2 === "number");

  const sorted = sortByRelevance(deduped, { priorityChunkTypes: ["pseudocode_validations_rules"], keywords: ["ALOCAT"] });
  assert.equal(sorted[0].id, 3);

  const top1 = selectTop(sorted, 1);
  assert.equal(top1.length, 1);
  assert.equal(top1[0].id, 3);
});
