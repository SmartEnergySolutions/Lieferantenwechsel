const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreSection } = require('../src/quality/validator');

test('scoreSection produces reasonable scores', () => {
  const poor = scoreSection('Kurz');
  assert.ok(poor.score <= 0.6);
  const filler = (' word').repeat(80); // ensures > minWords
  const good = scoreSection(`# Titel\n\nAusgewählte Quellen:\n- a\n\n${filler}`);
  assert.ok(good.score >= 0.9);
});
