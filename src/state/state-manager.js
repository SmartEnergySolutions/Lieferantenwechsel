"use strict";

const fs = require("fs-extra");
const path = require("path");
const log = require("../utils/logger");
const { ensureDirs, atomicWrite } = require("../utils/file-manager");
const cfg = require("../config/config");

class StateManager {
  constructor(stateDir) {
    this.stateDir = stateDir || cfg.state.dir;
    this.currentStateFile = path.join(this.stateDir, "current-generation.json");
    this.chapterStatesDir = path.join(this.stateDir, "chapter-states");
    this.checkpointsDir = path.join(this.stateDir, "checkpoints");
    this.searchCacheDir = path.join(this.stateDir, "search-cache");
    this.autosave = null;
    this._saving = false;
  }

  async ensureDirectories() {
    await ensureDirs([
      this.stateDir,
      this.chapterStatesDir,
      this.checkpointsDir,
      this.searchCacheDir,
    ]);
  }

  getDefaultPreferences() {
    return {
      searchStrategy: { alpha: 0.7, priorityChunkTypes: ["pseudocode_flow", "pseudocode_validations_rules"], adaptiveKeywords: [] },
      contentPreferences: { exampleDensity: "medium", technicalDetail: "medium", crossReferenceStyle: "inline" },
    };
  }

  async initializeState(ebookConfig = {}) {
    await this.ensureDirectories();
    const initial = {
      generationId: `gen_${Date.now()}`,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      version: "1.0.0",
      status: "INITIALIZED",
      currentPhase: { phase: "INITIALIZATION", interruptible: true, lastCheckpoint: null },
      completedChapters: [],
      globalSettings: {
        interactiveMode: !!ebookConfig.interactive,
        detailLevel: ebookConfig.detailLevel || "standard",
        maxIterationsPerSection: ebookConfig.maxIterations || 4,
        autoSaveInterval: cfg.state.autosaveMs,
      },
      userPreferences: this.getDefaultPreferences(),
      statistics: { totalSearchQueries: 0, totalUserInteractions: 0, averageSectionTime: 0, cacheHitRatio: 0 },
    };
    await atomicWrite(this.currentStateFile, initial);
    this.startAutoSave();
    log.info("state initialized", { id: initial.generationId });
    return initial;
  }

  startAutoSave() {
    if (this.autosave) return;
    this.autosave = setInterval(() => this.saveState().catch(() => {}), Math.max(3000, cfg.state.autosaveMs));
    if (this.autosave.unref) this.autosave.unref();
  }

  stopAutoSave() {
    if (this.autosave) clearInterval(this.autosave);
    this.autosave = null;
  }

  async getCurrentState() {
    try {
      const txt = await fs.readFile(this.currentStateFile, "utf-8");
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }

  async saveState(stateData = null) {
    if (this._saving) return;
    this._saving = true;
    try {
      const current = stateData || (await this.getCurrentState()) || {};
      current.lastUpdate = new Date().toISOString();
      await atomicWrite(this.currentStateFile, current);
      log.debug("state saved", { phase: current?.currentPhase?.phase, status: current?.status });
    } finally {
      this._saving = false;
    }
  }

  async createCheckpoint(description = "Manual checkpoint", type = "MANUAL") {
    const s = (await this.getCurrentState()) || {};
    const id = `cp_${Date.now()}`;
    const file = path.join(this.checkpointsDir, `${id}.json`);
    const snapshot = {
      checkpointId: id,
      createdAt: new Date().toISOString(),
      type,
      description,
      stateSnapshot: { currentGeneration: s, chapterStates: await this.loadAllChapterStates(), searchCache: await this.loadSearchCache() },
      resumeInstructions: { nextPhase: s?.currentPhase?.phase || "INITIALIZATION" },
      metadata: { generatedContent: { completedChapters: (s.completedChapters || []).length } },
    };
    await atomicWrite(file, snapshot);
    s.currentPhase = s.currentPhase || {};
    s.currentPhase.lastCheckpoint = id;
    await this.saveState(s);
    // cleanup
    await this.cleanupOldCheckpoints();
    return id;
  }

  async getLatestCheckpoint() {
    await fs.ensureDir(this.checkpointsDir);
    const files = (await fs.readdir(this.checkpointsDir)).filter((f) => f.endsWith(".json"));
    if (!files.length) return null;
    files.sort();
    const latest = files[files.length - 1];
    const data = await fs.readJson(path.join(this.checkpointsDir, latest));
    return { checkpointId: data.checkpointId, file: path.join(this.checkpointsDir, latest), createdAt: data.createdAt };
  }

  async recoverFromCheckpoint(checkpointId) {
    const file = path.join(this.checkpointsDir, `${checkpointId}.json`);
    const data = await fs.readJson(file);
  const restored = data.stateSnapshot.currentGeneration;
  await atomicWrite(this.currentStateFile, restored);
  log.info("recovered from checkpoint", { checkpointId });
  return restored;
  }

  async recoverFromCrash() {
    // If current state is present, consider recovery successful (nothing to do)
    let current = await this.getCurrentState();
    if (current && typeof current === "object") {
      return { recovered: true, reason: "STATE_OK" };
    }
    const latest = await this.getLatestCheckpoint();
    if (latest) {
      await this.recoverFromCheckpoint(latest.checkpointId);
      return { recovered: true, from: latest.checkpointId };
    }
    // if nothing, re-initialize
    await this.initializeState({});
    return { recovered: true, from: "NEW_STATE" };
  }

  async loadAllChapterStates() {
    const out = {};
    await fs.ensureDir(this.chapterStatesDir);
    const files = await fs.readdir(this.chapterStatesDir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        out[path.basename(f, ".json")] = await fs.readJson(path.join(this.chapterStatesDir, f));
      } catch {}
    }
    return out;
  }

  async loadSearchCache() {
    const dir = path.join(this.searchCacheDir, "queries");
    const out = {};
    await fs.ensureDir(dir);
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        out[path.basename(f, ".json")] = await fs.readJson(path.join(dir, f));
      } catch {}
    }
    return out;
  }

  async cleanupOldCheckpoints() {
    const keep = cfg.state.checkpointsToKeep;
    await fs.ensureDir(this.checkpointsDir);
    const files = (await fs.readdir(this.checkpointsDir)).filter((f) => f.endsWith(".json")).sort();
    if (files.length <= keep) return 0;
    const toDelete = files.slice(0, files.length - keep);
    for (const f of toDelete) {
      try { await fs.remove(path.join(this.checkpointsDir, f)); } catch {}
    }
    return toDelete.length;
  }

  async handleGracefulShutdown() {
    this.stopAutoSave();
    await this.saveState();
    try { await this.createCheckpoint("Emergency shutdown", "EMERGENCY"); } catch {}
  }
}

module.exports = { StateManager };
 
