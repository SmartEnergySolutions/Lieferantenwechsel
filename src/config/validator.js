"use strict";

const fs = require("fs-extra");
const path = require("path");
const cfg = require("./config");

async function validateConfig() {
  const issues = [];
  // outputs/state dirs
  try { await fs.ensureDir(cfg.outputs.dir); } catch (e) { issues.push({ key: "outputs.dir", level: "ERROR", message: e.message }); }
  try { await fs.ensureDir(cfg.state.dir); } catch (e) { issues.push({ key: "state.dir", level: "ERROR", message: e.message }); }
  // qdrant URL basic sanity
  if (!cfg.qdrant.url || !/^https?:\/\//.test(cfg.qdrant.url)) {
    issues.push({ key: "qdrant.url", level: "WARN", message: "Qdrant URL looks invalid; network ops may be skipped" });
  }
  // embeddings size
  if (!Number.isFinite(cfg.embeddings.size) || cfg.embeddings.size <= 0) {
    issues.push({ key: "embeddings.size", level: "ERROR", message: "Embeddings size must be a positive integer" });
  }
  // active chapters sanity (if set)
  try {
    const { getActiveChapters } = require("./loader");
    const { chapters } = await getActiveChapters();
    if (!Array.isArray(chapters) || chapters.length === 0) {
      issues.push({ key: "chapters", level: "WARN", message: "No chapters configured" });
    }
  } catch (e) {
    issues.push({ key: "chapters", level: "WARN", message: `Failed reading chapters: ${e.message}` });
  }
  const valid = issues.every(i => i.level !== "ERROR");
  return { valid, issues };
}

module.exports = { validateConfig };
