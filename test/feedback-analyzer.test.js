"use strict";

const assert = require("assert");
const { test } = require("node:test");
const { analyzeFeedback } = require("../src/interactive/feedback-analyzer");

test("analyzeFeedback summarizes counts and produces suggestions", () => {
  const history = [
    { type: "QUALITY", feedback: "Mehr Beispiele, bitte.", context: { term: "ANMELD", chunk_type: "pseudocode_flow" } },
    { type: "QUALITY", feedback: "Mehr technische Details.", context: { term: "ALOCAT", chunkType: "pseudocode_validations_rules" } },
    { type: "NOTE", feedback: "passt" },
  ];
  const rep = analyzeFeedback(history);
  assert.equal(rep.total, 3);
  assert.ok(rep.counts.QUALITY === 2);
  assert.ok(Array.isArray(rep.suggestions.search.priorityChunkTypes));
  assert.ok(rep.suggestions.content.exampleDensity);
});
