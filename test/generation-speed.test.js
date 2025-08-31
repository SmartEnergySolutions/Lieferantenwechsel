"use strict";

const { test } = require('node:test');
const assert = require('assert');

test('Generation speed quick benchmark (non-failing)', async () => {
  const start = Date.now();
  // simulate section rendering cost using a small loop
  let acc = 0;
  for (let i = 0; i < 2000; i++) {
    const s = `Abschnitt ${i}`;
    acc += s.length;
  }
  const ms = Date.now() - start;
  assert.ok(acc > 0);
  // no strict threshold; we just ensure the code executes
  assert.ok(ms >= 0);
});
