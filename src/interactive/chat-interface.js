const readline = require('readline');
const logger = require('../utils/logger');
const { QdrantClient } = require('../retrieval/qdrant-client');
const { embedText } = require('../retrieval/embeddings');
const { basicFilter, mergeWeighted } = require('../retrieval/search-strategies');
const { SessionPersistence } = require('./session-persistence');
const { getActiveChapters } = require('../config/loader');

class ChatInterface {
  constructor(stateManager, sessionManager, { checkpointOnReview = false, sessionPersistence = null } = {}) {
    this.stateManager = stateManager;
    this.sessionManager = sessionManager;
    this.checkpointOnReview = checkpointOnReview;
    this.currentContext = null;
    this.sessionPersistence = sessionPersistence instanceof SessionPersistence ? sessionPersistence : (sessionPersistence || null);
  }

  async startInteractiveSession() {
    process.on('SIGINT', async () => { await this.handleGracefulShutdown(); process.exit(0); });
    logger.info('interactive session start');
    // Simple loop: choose chapter -> enter term -> search -> review -> select -> generate section (optional)
  const chapterRaw = await this.ask('Kapitel-ID (z.B. 01-overview oder Titel frei): ');
  const chapterId = await this.resolveChapterId(chapterRaw);
    const term = await this.ask('Suchbegriff: ');
  const alphaIn = parseFloat((await this.ask('Alpha (0.5-0.95, Enter=0.7): ')) || '0.7');
  const alpha = Number.isFinite(alphaIn) ? Math.min(0.95, Math.max(0.5, alphaIn)) : 0.7;
  const limitIn = parseInt((await this.ask('Max Ergebnisse (Enter=10): ')) || '10', 10);
  const limit = Number.isFinite(limitIn) ? Math.min(200, Math.max(1, limitIn)) : 10;
  let results = await this.searchEmbedFilter(term, { alpha, limit });
    try {
      const { filterByChunkTypes, dedupeByIdOrSource, sortByRelevance } = require('../retrieval/content-analyzer');
      // Prefer typical instruction-bearing chunks first; this can be adjusted later by user
      const priority = ['pseudocode_flow', 'pseudocode_validations_rules', 'structured_table'];
      results = filterByChunkTypes(results, priority).concat(results); // keep priority first but retain others
      results = dedupeByIdOrSource(results);
      results = sortByRelevance(results, { priorityChunkTypes: priority, keywords: [term] });
    } catch {}
  await this.displaySearchResults(results, { chapterId, term, alpha });
    const total = results.length;
    const selRaw = await this.ask(`Auswahlindizes (z.B. 0,1,2 oder top:3, Enter=top:3): `);
    const { parseSelectArg } = require('./review');
    const selected = parseSelectArg(selRaw || 'top:3', total) || [];
    const decision = await this.sessionManager.addPendingDecision(chapterId, {
      type: 'EMBEDDED_SEARCH_SELECTION',
      context: { term, alpha, results }
    });
    await this.sessionManager.resolveDecision(chapterId, decision.decisionId, { selected, approved: true });
    if (this.checkpointOnReview) {
      try { await this.stateManager.createCheckpoint(`Review ${chapterId}`, 'PHASE_TRANSITION'); } catch {}
    }
    const gen = (await this.ask('Section jetzt generieren? (y/N): ')).toLowerCase().startsWith('y');
    if (gen) {
      const sectionName = await this.ask('Section-Titel: ');
      const { generateSection } = require('../generator/section-generator');
      const res = await generateSection({ stateManager: this.stateManager, chapterId, sectionName });
      logger.info('interactive generated', res);
    }
    logger.info('interactive session end');
  }

  async displaySearchResults(results, context) {
    logger.info('search results', { chapterId: context.chapterId, term: context.term, alpha: context.alpha, count: results.length });
    try { await this.saveInteractionContext(context, results); } catch {}
    const { printResults } = require('./review');
    printResults(results);
  }

  async handleGracefulShutdown() {
    logger.warn('interactive shutdown');
    try {
      await this.stateManager.saveState();
      if (this.checkpointOnReview) {
        await this.stateManager.createCheckpoint('Interactive session shutdown', 'EMERGENCY');
      }
    } catch {}
  }

  async searchEmbedFilter(term, { alpha = 0.7, limit = 10 } = {}) {
    const cfg = require('../config/config');
    const qc = new QdrantClient();
    const collection = cfg.qdrant.collection;
    // Try to discover the vector size from Qdrant; fall back to configured size.
    let vecSize = cfg.embeddings.size;
    try {
      const meta = await qc.getCollection(collection);
      const declared = meta?.config?.params?.vectors?.size || meta?.vectors?.size;
      if (Number.isFinite(declared) && declared > 0) vecSize = declared;
    } catch {}

    let vec = await embedText(term, vecSize);
    const filter = basicFilter(term);

    try {
      const base = await qc.searchPoints(collection, vec, { limit, with_payload: true });
      const filtered = await qc.searchPoints(collection, vec, { limit, filter, with_payload: true });
      return mergeWeighted(base, filtered, alpha).slice(0, limit);
    } catch (e) {
      // Retry on potential vector-size mismatch by re-reading collection size.
      const status = e?.response?.status;
      const msg = e?.response?.data?.status?.error || e?.message;
      if (status === 400) {
        try {
          const meta = await qc.getCollection(collection);
          const declared = meta?.config?.params?.vectors?.size || meta?.vectors?.size;
          if (Number.isFinite(declared) && declared > 0 && declared !== vecSize) {
            vecSize = declared;
            vec = await embedText(term, vecSize);
            const base = await qc.searchPoints(collection, vec, { limit, with_payload: true });
            const filtered = await qc.searchPoints(collection, vec, { limit, filter, with_payload: true });
            return mergeWeighted(base, filtered, alpha).slice(0, limit);
          }
        } catch {}
      }
      // Surface a clearer error upstream
      throw new Error(`Qdrant search failed (${status || 'n/a'}): ${msg || 'unknown error'}`);
    }
  }

  async resolveChapterId(input) {
    const raw = String(input || '').trim();
    if (!raw) return raw;
    try {
      const { chapters } = await getActiveChapters();
      const byId = chapters.find(c => (c.id || '').toLowerCase() === raw.toLowerCase());
      if (byId) return byId.id;
      const byTitle = chapters.find(c => (c.title || '').toLowerCase().includes(raw.toLowerCase()));
      if (byTitle) return byTitle.id;
      // Fallback: slugify-ish
      return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    } catch {
      return raw;
    }
  }

  ask(prompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(prompt, (ans) => { rl.close(); resolve(ans); }));
  }

  async saveInteractionContext(context, data) {
    const s = (await this.stateManager.getCurrentState()) || {};
    s.metadata = s.metadata || {};
    s.metadata.interactions = s.metadata.interactions || [];
    const entry = { context, items: Array.isArray(data) ? data.length : (data ? 1 : 0), savedAt: new Date().toISOString() };
    s.metadata.interactions.push(entry);
    await this.stateManager.saveState(s);
    this.currentContext = context || null;
    return entry;
  }

  async persistFeedback(type, feedback) {
    try {
      // ensure session persistence available
      if (!this.sessionPersistence) this.sessionPersistence = new SessionPersistence();
      if (!this.sessionPersistence.currentSessionId) {
        await this.sessionPersistence.startNewSession({ interactive: true, mode: 'chat' });
      }
      const ctx = { context: this.currentContext || {}, statePhase: (await this.stateManager.getCurrentState())?.currentPhase?.phase || null };
      await this.sessionPersistence.saveFeedback(type, feedback, ctx);
      // update global interaction stats
      const s = (await this.stateManager.getCurrentState()) || {};
      s.statistics = s.statistics || {};
      s.statistics.totalUserInteractions = (s.statistics.totalUserInteractions || 0) + 1;
      await this.stateManager.saveState(s);
      return true;
    } catch (e) {
      logger.warn('persistFeedback failed', { error: e.message });
      return false;
    }
  }

  async resumeFromPendingDecision() {
    try {
      const list = await this.sessionManager.listPendingDecisions();
      if (!list || !list.length) return null;
      const latest = list[list.length - 1];
      this.currentContext = { chapterId: latest.chapterId, type: latest.type };
      return latest;
    } catch {
      return null;
    }
  }
}

module.exports = { ChatInterface };
