"use strict";

const fs = require("fs-extra");
const path = require("path");
const cfg = require("./config");

function activeConfigPath() {
  return path.join(cfg.state.dir, "config", "current-config.json");
}

function normalizeChapter(ch) {
  if (!ch || typeof ch !== "object") return null;
  const id = String(ch.id || "").trim();
  const title = String(ch.title || id || "Untitled");
  const level = ch.level || "standard";
  const sections = Array.isArray(ch.sections) ? ch.sections.map(s => String(s)) : [];
  const searchQueries = Array.isArray(ch.searchQueries) ? ch.searchQueries.map(s => String(s)) : (Array.isArray(ch.queries) ? ch.queries.map(s => String(s)) : []);
  const dependencies = Array.isArray(ch.dependencies) ? ch.dependencies.map(s => String(s)) : [];
  const validationCriteria = ch.validationCriteria && typeof ch.validationCriteria === "object" ? ch.validationCriteria : { requiredSections: 1 };
  if (!id) return null;
  return { id, title, level, sections, searchQueries, dependencies, validationCriteria };
}

async function setActiveConfig(configObj) {
  const file = activeConfigPath();
  await fs.mkdirp(path.dirname(file));
  await fs.writeJson(file, configObj, { spaces: 2 });
  return file;
}

async function clearActiveConfig() {
  const file = activeConfigPath();
  try { await fs.remove(file); } catch {}
  return file;
}

async function loadFromFile(filePath) {
  const full = path.resolve(filePath);
  let raw;
  try {
    const text = await fs.readFile(full, "utf-8");
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to read JSON config: ${e.message}`);
  }
  const chaptersIn = Array.isArray(raw?.chapters) ? raw.chapters : Array.isArray(raw) ? raw : [];
  if (!chaptersIn.length) throw new Error("Config must contain an array 'chapters' or be an array of chapters");
  const chapters = chaptersIn.map(normalizeChapter).filter(Boolean);
  if (!chapters.length) throw new Error("No valid chapters in config");
  const stored = { chapters };
  const file = await setActiveConfig(stored);
  return { file, chapters: chapters.map(c => ({ id: c.id, sections: c.sections.length })) };
}

async function getActiveChapters() {
  const file = activeConfigPath();
  try {
    const data = await fs.readJson(file);
    const chapters = Array.isArray(data?.chapters) ? data.chapters.map(normalizeChapter).filter(Boolean) : [];
    if (chapters.length) return { source: "custom", chapters };
  } catch {}
  // Fallback to static config
  const { CHAPTERS } = require("./ebook-structure");
  return { source: "default", chapters: CHAPTERS };
}

module.exports = { loadFromFile, getActiveChapters, setActiveConfig, clearActiveConfig, activeConfigPath };
