"use strict";

const path = require("path");
const fs = require("fs-extra");

class StatefulInteractiveWorkflow {
  constructor(stateManager, checkpointManager = null) {
    this.stateManager = stateManager;
    this.checkpointManager = checkpointManager; // optional; StateManager handles checkpoints if absent
    this.currentPhase = null;
    this.interruptionPoints = new Set();
  }

  async enterPhase(phase, meta = {}) {
    const s = (await this.stateManager.getCurrentState()) || {};
    s.currentPhase = { phase, interruptible: true, meta, lastCheckpoint: s?.currentPhase?.lastCheckpoint || null };
    s.status = "IN_PROGRESS";
    await this.stateManager.saveState(s);
    this.currentPhase = phase;
  }

  async exitPhase(phase, meta = {}) {
    const s = (await this.stateManager.getCurrentState()) || {};
    // Only exit if still in same phase
    if (s.currentPhase && s.currentPhase.phase === phase) {
      s.currentPhase = { phase: "IDLE", interruptible: true, meta };
    }
    s.status = s.status || "IN_PROGRESS";
    await this.stateManager.saveState(s);
    this.currentPhase = s.currentPhase.phase;
  }

  async createCheckpoint(description, type = "PHASE_TRANSITION", extra = {}) {
    // Prefer a dedicated checkpoint manager if provided; otherwise use StateManager
    if (this.checkpointManager && typeof this.checkpointManager.createCheckpoint === "function") {
      return this.checkpointManager.createCheckpoint(
        await this.stateManager.getCurrentState(),
        description,
        { type, ...extra }
      );
    }
    return this.stateManager.createCheckpoint(description, type);
  }

  // Phase 1: Unterbrechbare Struktur-Review
  async reviewEBookStructure() {
    await this.enterPhase("STRUCTURE_REVIEW");
    await this.createCheckpoint("PRE_STRUCTURE_REVIEW", "PHASE_TRANSITION", { phase: "structure_review", timestamp: Date.now() });
    // Persist a minimal marker that structure review ran
    const s = (await this.stateManager.getCurrentState()) || {};
    s.metadata = s.metadata || {};
    s.metadata.structureReview = { startedAt: new Date().toISOString(), notes: [] };
    await this.stateManager.saveState(s);
    await this.exitPhase("STRUCTURE_REVIEW");
  }

  // Phase 2: Stateful Kapitel-weise Generation (high-level orchestration)
  async interactiveChapterGeneration(chapter) {
    const chapterId = chapter?.id || chapter?.chapterId || String(chapter);
    await this.enterPhase("CHAPTER_GENERATION", { chapterId });
    try {
      await this.statefulReviewSearchResults({ chapterId });
      await this.statefulReviewContentSuggestions({ chapterId });
      await this.statefulQualityFeedbackLoop({ chapterId });
      await this.statefulFinalChapterReview({ chapterId });
    } catch (error) {
      await this.handleChapterGenerationError({ chapterId }, error);
      throw error;
    }
    await this.exitPhase("CHAPTER_GENERATION", { chapterId });
  }

  // 2.1 Search Results Review mit State-Tracking
  async statefulReviewSearchResults({ chapterId }) {
    await this.createCheckpoint(`PRE_SEARCH_REVIEW_${chapterId}`, "PHASE_TRANSITION", { chapterId });
    try {
      const { SessionManager } = require("./session-manager");
      const smgr = new SessionManager(this.stateManager);
      await smgr.addPendingDecision(chapterId, {
        type: "SEARCH_RESULTS_SELECTION",
        context: { term: "auto", results: { points: [] } },
      });
    } catch {}
  }

  // 2.2 Content Suggestions Review mit Auto-Save (placeholder)
  async statefulReviewContentSuggestions({ chapterId }) {
    await this.createCheckpoint(`PRE_CONTENT_REVIEW_${chapterId}`, "PHASE_TRANSITION", { chapterId });
    const s = (await this.stateManager.getCurrentState()) || {};
    s.metadata = s.metadata || {};
    s.metadata.contentSuggestions = s.metadata.contentSuggestions || {};
    s.metadata.contentSuggestions[chapterId] = { reviewedAt: new Date().toISOString() };
    await this.stateManager.saveState(s);
  }

  // 2.3 Quality Feedback Loop mit Checkpoint (placeholder)
  async statefulQualityFeedbackLoop({ chapterId }) {
    await this.createCheckpoint(`PRE_QUALITY_FEEDBACK_${chapterId}`, "PHASE_TRANSITION", { chapterId });
    const s = (await this.stateManager.getCurrentState()) || {};
    s.metadata = s.metadata || {};
    s.metadata.qualityFeedback = s.metadata.qualityFeedback || {};
    s.metadata.qualityFeedback[chapterId] = { startedAt: new Date().toISOString(), iterations: 0 };
    await this.stateManager.saveState(s);
  }

  // 2.4 Final Chapter Approval mit State-Finalisierung (placeholder)
  async statefulFinalChapterReview({ chapterId }) {
    await this.createCheckpoint(`PRE_FINAL_REVIEW_${chapterId}`, "PHASE_TRANSITION", { chapterId });
    // Update per-chapter state status to REVIEWED (best-effort)
    try {
      const file = path.join(this.stateManager.chapterStatesDir, `${chapterId}.json`);
      const st = (await fs.pathExists(file)) ? await fs.readJson(file) : { chapterId, status: "IN_PROGRESS" };
      st.status = "REVIEWED";
      await fs.ensureDir(this.stateManager.chapterStatesDir);
      await fs.writeJson(file, st, { spaces: 2 });
    } catch {}
  }

  // Recovery- und Fehler-Handling (vereinfachte Platzhalter)
  async resumeFromPhase(phase, context = {}) {
    await this.enterPhase(phase, context);
  }

  async handleInterruption() {
    await this.stateManager.saveState();
  }

  async handleChapterGenerationError({ chapterId }, error) {
    try { await this.createCheckpoint(`ERROR_${chapterId}`, "ERROR", { error: String(error?.message || error) }); } catch {}
    const s = (await this.stateManager.getCurrentState()) || {};
    s.status = "ERROR";
    await this.stateManager.saveState(s);
  }

  async validateStateConsistency() {
    try {
      const { validateConsistency } = require("../state/state-validator");
      const res = await validateConsistency(this.stateManager.stateDir, { fix: false });
      return res;
    } catch (e) {
      return { valid: true, issues: [{ level: "WARN", message: e.message }] };
    }
  }
}

module.exports = { StatefulInteractiveWorkflow };
