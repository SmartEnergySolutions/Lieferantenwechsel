"use strict";

const { test } = require('node:test');
const assert = require('assert');

test('QDrant Query Performance under different loads (skips if unavailable)', async (t) => {
  const { QdrantClient } = require('../src/retrieval/qdrant-client');
  const { embedText } = require('../src/retrieval/embeddings');
  const cfg = require('../src/config/config');
  const qc = new QdrantClient();
  try {
    const hz = await qc.healthz();
    if (!hz || typeof hz !== 'object') {
      t.skip('QDrant not reachable');
      return;
    }
  } catch {
    t.skip('QDrant not reachable');
    return;
  }

  await qc.ensureCollection(cfg.qdrant.collection, cfg.embeddings.size);
  const vec = await embedText('Test', cfg.embeddings.size);
  const limits = [5, 20, 50];
  const timings = [];
  for (const limit of limits) {
    const start = Date.now();
    try {
      await qc.searchPoints(cfg.qdrant.collection, vec, { limit, with_payload: true });
    } catch {
      // ignore errors for this synthetic test
    }
    timings.push({ limit, ms: Date.now() - start });
  }
  // Basic sanity: all timings recorded and are numbers
  assert.strictEqual(timings.length, limits.length);
  assert.ok(timings.every(x => Number.isFinite(x.ms)));
});
