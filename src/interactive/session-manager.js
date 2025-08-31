const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

class SessionManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.chapterStatesDir = this.stateManager.chapterStatesDir;
  }

  async addPendingDecision(chapterId, decision) {
    const file = path.join(this.chapterStatesDir, `${chapterId}.json`);
    let state = { chapterId, status: 'IN_PROGRESS', pendingDecisions: [] };
    try {
      state = JSON.parse(await fs.readFile(file, 'utf-8'));
    } catch {}
    state.pendingDecisions = state.pendingDecisions || [];
    state.pendingDecisions.push({ ...decision, decisionId: decision.decisionId || `decision_${Date.now()}` });
    await fs.mkdirp(this.chapterStatesDir);
    await fs.writeFile(file, JSON.stringify(state, null, 2));
    logger.info('Pending decision added', { chapterId, type: decision.type });
    return state.pendingDecisions[state.pendingDecisions.length - 1];
  }

  async listPendingDecisions() {
    await fs.mkdirp(this.chapterStatesDir);
    const files = (await fs.readdir(this.chapterStatesDir)).filter((f) => f.endsWith('.json'));
    const out = [];
    for (const f of files) {
      try {
        const s = JSON.parse(await fs.readFile(path.join(this.chapterStatesDir, f), 'utf-8'));
        (s.pendingDecisions || []).forEach((d) => out.push({ chapterId: s.chapterId, ...d }));
      } catch {}
    }
    return out;
  }

  async resolveDecision(chapterId, decisionId, resolution) {
    const file = path.join(this.chapterStatesDir, `${chapterId}.json`);
    const s = JSON.parse(await fs.readFile(file, 'utf-8'));
    const pending = s.pendingDecisions || [];
    const target = pending.find((d) => d.decisionId === decisionId);
    s.pendingDecisions = pending.filter((d) => d.decisionId !== decisionId);
    s.completedDecisions = s.completedDecisions || [];
    s.completedDecisions.push({ decisionId, resolution, resolvedAt: new Date().toISOString() });

    // If this is a search selection decision, persist a compact history entry
    try {
      const type = target?.type || 'GENERIC';
      if (type === 'SEARCH_RESULTS_SELECTION' || type === 'EMBEDDED_SEARCH_SELECTION') {
        const rawResults = target?.context?.results;
        const items = Array.isArray(rawResults?.points) ? rawResults.points : (Array.isArray(rawResults) ? rawResults : []);
        const indices = Array.isArray(resolution?.selected) ? resolution.selected : [];
        const selectedItems = indices.map((i) => items[i]).filter(Boolean);
        const selectedResultIds = selectedItems.map((it) => it?.id).filter((id) => id !== undefined);
        s.searchHistory = s.searchHistory || [];
        s.searchHistory.push({
          decisionId,
          type,
          term: target?.context?.term || null,
          alpha: target?.context?.alpha ?? null,
          selectedIndices: indices,
          selectedResultIds,
          selectedItems,
          count: selectedItems.length,
          decidedAt: new Date().toISOString(),
          strategy: type === 'EMBEDDED_SEARCH_SELECTION' ? 'embed+filter' : 'filter',
        });
      }
    } catch {}

    await fs.writeFile(file, JSON.stringify(s, null, 2));
    // Update global stats (best-effort)
    try {
      const g = (await this.stateManager.getCurrentState()) || {};
      g.statistics = g.statistics || {};
      g.statistics.totalUserInteractions = (g.statistics.totalUserInteractions || 0) + 1;
      await this.stateManager.saveState(g);
    } catch {}
    logger.info('Decision resolved', { chapterId, decisionId });
  }
}

module.exports = { SessionManager };
