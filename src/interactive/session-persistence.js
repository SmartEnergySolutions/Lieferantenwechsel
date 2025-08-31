const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const cfg = require('../config/config');

class SessionPersistence {
  constructor(outputDir = cfg.outputs.dir) {
    this.sessionDir = path.join(outputDir, 'interactive-sessions');
    this.currentSessionId = null;
  }

  async startNewSession(ebookConfig = {}) {
    await fs.mkdirp(this.sessionDir);
    this.currentSessionId = `session_${Date.now()}`;
    const sessionData = {
      id: this.currentSessionId,
      startTime: new Date().toISOString(),
      ebookConfig,
      chapterProgress: {},
      userPreferences: {},
      feedbackHistory: [],
      searchStrategies: {},
      qualityMetrics: {},
    };
    await this.#write(sessionData);
    logger.info('session started', { id: this.currentSessionId });
    return this.currentSessionId;
  }

  async saveChapterProgress(chapterId, progressData) {
    const s = await this.#read();
    s.chapterProgress = s.chapterProgress || {};
    s.chapterProgress[chapterId] = { ...progressData, timestamp: new Date().toISOString() };
    await this.#write(s);
  }

  async saveFeedback(type, feedback, context = {}) {
    const s = await this.#read();
    s.feedbackHistory = s.feedbackHistory || [];
    s.feedbackHistory.push({ type, feedback, context, timestamp: new Date().toISOString() });
    await this.#write(s);
  }

  async resumeSession(sessionId) {
    this.currentSessionId = sessionId;
    const s = await this.#read();
    logger.info('session resume', { id: sessionId, started: s.startTime, chapters: Object.keys(s.chapterProgress || {}).length });
    return s;
  }

  async generateSessionReport(sessionId = this.currentSessionId) {
    const s = await this.#read(sessionId);
    const durationMs = Date.now() - new Date(s.startTime).getTime();
    const chaptersCompleted = Object.keys(s.chapterProgress || {}).length;
    const totalFeedback = (s.feedbackHistory || []).length;
    const qualityScores = Object.values(s.chapterProgress || {}).map((p) => p.qualityScore).filter((n) => typeof n === 'number');
    const avgQuality = qualityScores.length ? Number((qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(2)) : null;
    return {
      sessionSummary: { durationMs, chaptersCompleted, totalFeedback },
      averageQuality: avgQuality,
      feedbackCounts: this.#countByType(s.feedbackHistory || []),
    };
  }

  async listSessions() {
    await fs.mkdirp(this.sessionDir);
    const files = (await fs.readdir(this.sessionDir)).filter((f) => f.endsWith('.json'));
    files.sort();
    return files.map((f) => ({ id: path.basename(f, '.json'), file: path.join(this.sessionDir, f) }));
  }

  async #read(sessionId = this.currentSessionId) {
    if (!sessionId) throw new Error('No sessionId set');
    const file = path.join(this.sessionDir, `${sessionId}.json`);
    return fs.pathExists(file) ? fs.readJson(file) : { id: sessionId, startTime: new Date().toISOString() };
  }

  async #write(data) {
    await fs.mkdirp(this.sessionDir);
    const file = path.join(this.sessionDir, `${data.id}.json`);
    await fs.writeJson(file, data, { spaces: 2 });
  }

  #countByType(list) {
    const out = {};
    for (const it of list) out[it.type] = (out[it.type] || 0) + 1;
    return out;
  }
}

module.exports = { SessionPersistence };
