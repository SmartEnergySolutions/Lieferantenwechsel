"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { derivePreferences, applyLearning } = require("../src/interactive/learning-engine");
const { StateManager } = require("../src/state/state-manager");
const path = require("path");
const fs = require("fs-extra");

test("derivePreferences maps feedback to prefs", () => {
  const history = [
    { type: "LIKE", feedback: "Mehr technische Details und Beispiele", context: { term: "UTILMD", chunk_type: "pseudocode_flow" } },
    { type: "DISLIKE", feedback: "Bitte mehr Beispiele", context: { term: "ANMELD" } },
  ];
  const prefs = derivePreferences(history);
  assert.equal(prefs.contentPreferences.exampleDensity, "high");
  assert.equal(prefs.contentPreferences.technicalDetail, "high");
  assert.ok(prefs.searchStrategy.priorityChunkTypes.includes("pseudocode_flow"));
  assert.ok(prefs.searchStrategy.adaptiveKeywords.includes("UTILMD"));
});

test("applyLearning updates state userPreferences", async (t) => {
  const tmp = path.join(__dirname, "..", "state-test-" + Date.now());
  await fs.ensureDir(tmp);
  const sm = new StateManager(tmp);
  await sm.initializeState({});

  const history = [
    { type: "LIKE", feedback: "Mehr technische Details", context: { term: "GPKE" } },
    { type: "LIKE", feedback: "Mehr Beispiele", context: { term: "ALOCAT" } },
  ];

  const before = await sm.getCurrentState();
  assert.ok(before.userPreferences);
  const updated = await applyLearning({ stateManager: sm, history });
  assert.ok(updated.searchStrategy.alpha >= 0.7);
  assert.ok(updated.searchStrategy.adaptiveKeywords.includes("ALOCAT"));

  const after = await sm.getCurrentState();
  assert.deepEqual(after.userPreferences, updated);
});
