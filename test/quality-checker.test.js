"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateQuality } = require("../src/interactive/quality-checker");

test("evaluateQuality computes score and suggestions", () => {
  const md = `# Titel\n\n## Abschnitt\n\nDies ist ein Beispiel. EDI und UTILMD werden erwähnt.\n\n\`\`\`json\n{"a":1}\n\`\`\``;
  const rep = evaluateQuality(md);
  assert.ok(rep.score >= 0 && rep.score <= 1);
  assert.ok(rep.metrics.wordCount > 0);
  assert.ok(Array.isArray(rep.suggestions));
});
