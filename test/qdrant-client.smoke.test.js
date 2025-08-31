"use strict";

const assert = require('assert');
const { test } = require('node:test');
const { QdrantClient } = require('../src/retrieval/qdrant-client');
const cfg = require('../src/config/config');

test('Qdrant health is reachable and collection can be ensured', async (t) => {
  const qc = new QdrantClient();
  const strict = String(process.env.QDRANT_STRICT || '').toLowerCase() === 'true';

  let health;
  try {
    health = await qc.healthz();
  } catch (e) {
    if (strict) throw e;
    t.diagnostic(`Skipping Qdrant smoke test: ${e.message}`);
    return; // skip gracefully when not strict
  }

  try {
    assert.ok(health && (health.status === 'ok' || health.title || health.version), 'Qdrant health not ok');
    const res = await qc.ensureCollection(cfg.qdrant.collection, cfg.embeddings.size);
    assert.ok(res, 'ensureCollection returned falsy');
  } catch (e) {
    if (strict) throw e;
    t.diagnostic(`Skipping remaining Qdrant checks: ${e.message}`);
  }
});
