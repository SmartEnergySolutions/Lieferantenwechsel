"use strict";

const path = require("path");
const fs = require("fs-extra");
const crypto = require("crypto");

function dir() {
  const base = require("../config/config").state?.dir || path.resolve("state");
  return path.resolve(base, "search-cache", "queries");
}

async function ensureDir() {
  await fs.ensureDir(dir());
}

function keyFor({ term, collection, strategy = "filter", alpha = null, limit = 10 }) {
  const h = crypto.createHash("sha256");
  h.update(`${collection}|${strategy}|${alpha ?? ""}|${limit}|${term}`);
  return h.digest("hex");
}

function fileForKey(k) {
  return path.join(dir(), `${k}.json`);
}

const { config } = require("../config/config");

async function loadQuery(params) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  if (!(await fs.pathExists(f))) return null;
  try {
    const data = await fs.readJson(f);
    const ttl = config.cache?.ttlSec?.queries || 0;
    if (ttl > 0 && data?.timestamp) {
      const age = (Date.now() - new Date(data.timestamp).getTime()) / 1000;
      if (age > ttl) {
        try { await fs.remove(f); } catch {}
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function saveQuery(params, results) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  const payload = { key: k, term: params.term, collection: params.collection, strategy: params.strategy || "filter", alpha: params.alpha ?? null, limit: params.limit || 10, timestamp: new Date().toISOString(), hitCount: 0, results };
  await fs.writeJson(f, payload, { spaces: 0 });
  return payload;
}

async function incrementHit(params) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  if (!(await fs.pathExists(f))) return null;
  const data = await fs.readJson(f);
  data.hitCount = (data.hitCount || 0) + 1;
  await fs.writeJson(f, data, { spaces: 0 });
  return data.hitCount;
}

async function stats() {
  await ensureDir();
  const files = await fs.readdir(dir());
  let total = 0, hits = 0;
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const data = await fs.readJson(path.join(dir(), file));
    total += 1;
    hits += data.hitCount || 0;
  }
  return { entries: total, totalHits: hits };
}

async function clear() {
  await ensureDir();
  const files = await fs.readdir(dir());
  for (const file of files) {
    if (file.endsWith(".json")) await fs.remove(path.join(dir(), file));
  }
}

module.exports = { loadQuery, saveQuery, incrementHit, stats, clear, keyFor };
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

function dir() {
  const base = (require('../config/config').state?.dir) || path.resolve('state');
  return path.resolve(base, 'search-cache', 'queries');
}

async function ensureDir() {
  await fs.ensureDir(dir());
}

function keyFor({ term, collection, strategy = 'filter', alpha = null, limit = 10 }) {
  const h = crypto.createHash('sha256');
  h.update(`${collection}|${strategy}|${alpha ?? ''}|${limit}|${term}`);
  return h.digest('hex');
}

function fileForKey(k) {
  return path.join(dir(), `${k}.json`);
}

const { config } = require('../config/config');

async function loadQuery(params) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  if (!(await fs.pathExists(f))) return null;
  try {
    const data = await fs.readJson(f);
    const ttl = config.cache?.ttlSec?.queries || 0;
    if (ttl > 0 && data?.timestamp) {
      const age = (Date.now() - new Date(data.timestamp).getTime()) / 1000;
      if (age > ttl) {
        try { await fs.remove(f); } catch {}
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

async function saveQuery(params, results) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  const payload = {
    key: k,
    term: params.term,
    collection: params.collection,
    strategy: params.strategy || 'filter',
    alpha: params.alpha ?? null,
    limit: params.limit || 10,
    timestamp: new Date().toISOString(),
    hitCount: 0,
    results,
  };
  await fs.writeJson(f, payload, { spaces: 0 });
  return payload;
}

async function incrementHit(params) {
  await ensureDir();
  const k = keyFor(params);
  const f = fileForKey(k);
  if (!(await fs.pathExists(f))) return null;
  const data = await fs.readJson(f);
  data.hitCount = (data.hitCount || 0) + 1;
  await fs.writeJson(f, data, { spaces: 0 });
  return data.hitCount;
}

async function stats() {
  await ensureDir();
  const files = await fs.readdir(dir());
  let total = 0, hits = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const data = await fs.readJson(path.join(dir(), file));
    total += 1;
    hits += (data.hitCount || 0);
  }
  return { entries: total, totalHits: hits };
}

async function clear() {
  await ensureDir();
  const files = await fs.readdir(dir());
  for (const file of files) {
    if (file.endsWith('.json')) await fs.remove(path.join(dir(), file));
  }
}

module.exports = { loadQuery, saveQuery, incrementHit, stats, clear, keyFor };
