"use strict";

const axios = require('axios');
const crypto = require('crypto');
const { config } = require('../config/config');
const logger = require('../utils/logger');

function l2norm(vec) {
  const sum = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0) || 1);
  return vec.map((v) => v / sum);
}

function hashToInt(str, seed = 0) {
  // Deterministic 32-bit hash
  const hash = crypto.createHash('sha256');
  hash.update(seed.toString());
  hash.update(str);
  const buf = hash.digest();
  // Use first 4 bytes
  return buf.readUInt32BE(0);
}

function hashEmbed(text, size) {
  const vec = new Array(size).fill(0);
  const tokens = (text || '').toString().toLowerCase().split(/\s+/).filter(Boolean);
  tokens.forEach((tok, idx) => {
    const h1 = hashToInt(tok, idx);
    const h2 = hashToInt(tok, idx + 13);
    vec[h1 % size] += 1;
    vec[h2 % size] += 0.5;
  });
  return l2norm(vec);
}

function adaptVectorLength(vec, size) {
  if (vec.length === size) return vec;
  if (vec.length > size) return vec.slice(0, size);
  const out = vec.slice();
  while (out.length < size) out.push(0);
  return out;
}

async function openaiEmbed(text, size) {
  const apiKey = config.embeddings.openai.apiKey;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const baseURL = config.embeddings.openai.baseURL || 'https://api.openai.com/v1';
  const model = config.embeddings.openai.model || 'text-embedding-3-small';
  try {
    const res = await axios.post(
      `${baseURL}/embeddings`,
      { model, input: text },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const vec = res.data?.data?.[0]?.embedding || [];
    return adaptVectorLength(vec, size);
  } catch (e) {
    const status = e?.response?.status;
    const data = e?.response?.data;
    logger.warn('OpenAI embedding failed, falling back to hash', { status, data });
    return hashEmbed(text, size);
  }
}

async function embedText(text, size) {
  const provider = (config.embeddings?.provider || 'hash').toLowerCase();
  if (provider === 'openai') return openaiEmbed(text, size);
  // default local provider
  return hashEmbed(text, size);
}

module.exports = { embedText, hashEmbed };
