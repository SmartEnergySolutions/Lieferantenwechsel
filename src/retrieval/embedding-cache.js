const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { config } = require('../config/config');

function cacheDir() {
  const base = (require('../config/config').state?.dir) || path.resolve('state');
  return path.resolve(base, 'search-cache', 'embeddings');
}

async function ensureDir() {
  await fs.ensureDir(cacheDir());
}

function keyFor({ provider, size, term }) {
  const h = crypto.createHash('sha256');
  h.update(`${provider}|${size}|${term}`);
  return h.digest('hex');
}

function fileForKey(k) {
  return path.join(cacheDir(), `${k}.json`);
}

async function loadEmbedding(params) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  if (!(await fs.pathExists(f))) return null;
  try {
    const data = await fs.readJson(f);
    const ttl = config.cache?.ttlSec?.embeddings || 0;
    if (ttl > 0 && data?.timestamp) {
      const age = (Date.now() - new Date(data.timestamp).getTime()) / 1000;
      if (age > ttl) {
        try { await fs.remove(f); } catch {}
        return null;
      }
    }
    return Array.isArray(data?.vector) ? data.vector : null;
  } catch {
    return null;
  }
}

async function saveEmbedding(params, vector) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  await fs.writeJson(f, { provider: params.provider, size: params.size, term: params.term, vector, timestamp: new Date().toISOString() }, { spaces: 0 });
  return f;
}

module.exports = { loadEmbedding, saveEmbedding, keyFor };
