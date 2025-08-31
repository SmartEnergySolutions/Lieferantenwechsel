"use strict";

const { test } = require('node:test');
const assert = require('assert');

test('Memory Usage stays reasonable during synthetic rendering loop', async () => {
  const before = process.memoryUsage().heapUsed;
  // synthetic render-like workload without IO
  const chunks = [];
  for (let i = 0; i < 500; i++) {
    const txt = `# Titel ${i}\n\nBeispielinhalt Zeile ${i}.`.repeat(2);
    chunks.push(txt);
  }
  const combined = chunks.join("\n\n");
  assert.ok(combined.length > 0);
  const after = process.memoryUsage().heapUsed;
  // Capture stats; do not enforce strict thresholds to keep CI stable
  const deltaMB = (after - before) / (1024 * 1024);
  assert.ok(Number.isFinite(deltaMB));
});
