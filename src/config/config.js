"use strict";

const path = require("path");
const dotenv = require("dotenv");

// Load base .env and environment-specific overrides if present
dotenv.config();
try { dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: false }); } catch {}
const envName = process.env.NODE_ENV;
if (envName) {
  try { dotenv.config({ path: path.resolve(process.cwd(), `.env.${envName}`), override: false }); } catch {}
}

function getEnv(name, fallback = undefined) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v;
}

const outDir = path.resolve(process.cwd(), getEnv("OUTPUTS_DIR", "outputs"));
const stateDir = path.resolve(process.cwd(), getEnv("STATE_DIR", "state"));

const config = {
  env: getEnv("NODE_ENV", "development"),
  qdrant: {
    url: getEnv("QDRANT_URL", "http://localhost:6333"),
    apiKey: getEnv("QDRANT_API_KEY", ""),
    collection: getEnv("QDRANT_COLLECTION", "lieferantenwechsel"),
    timeoutMs: parseInt(getEnv("QDRANT_TIMEOUT_MS", "10000"), 10),
  },
  embeddings: {
    provider: (getEnv("EMBEDDINGS_PROVIDER", "hash") || "hash").toLowerCase(),
    size: parseInt(getEnv("EMBEDDINGS_SIZE", "768"), 10),
    openai: {
      apiKey: getEnv("OPENAI_API_KEY", ""),
      baseURL: getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
      model: getEnv("OPENAI_EMBED_MODEL", "text-embedding-3-small"),
    },
  },
  outputs: {
    dir: outDir,
    bundleDir: path.join(outDir, "bundle"),
  },
  state: {
    dir: stateDir,
    autosaveMs: parseInt(getEnv("AUTO_SAVE_INTERVAL", "30000"), 10),
    checkpointsToKeep: parseInt(getEnv("MAX_CHECKPOINTS", "10"), 10),
  },
  interactive: {
    enabled: getEnv("INTERACTIVE_MODE", "true") !== "false",
    feedbackTimeoutSec: parseInt(getEnv("FEEDBACK_TIMEOUT", "300"), 10),
  },
  cache: {
    ttlSec: {
      embeddings: parseInt(getEnv("EMBEDDINGS_CACHE_TTL_SEC", "86400"), 10),
      queries: parseInt(getEnv("QUERY_CACHE_TTL_SEC", "3600"), 10),
    },
  },
};

module.exports = config;
module.exports.config = config;
