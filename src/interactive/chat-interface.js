const readline = require('readline');
const logger = require('../utils/logger');
const { QdrantClient } = require('../retrieval/qdrant-client');
const { embedText } = require('../retrieval/embeddings');
const { basicFilter, mergeWeighted } = require('../retrieval/search-strategies');

class ChatInterface {
  constructor(stateManager, sessionManager, { checkpointOnReview = false } = {}) {
    this.stateManager = stateManager;
    this.sessionManager = sessionManager;
    this.checkpointOnReview = checkpointOnReview;
  }

  async startInteractiveSession() {
    process.on('SIGINT', async () => { await this.handleGracefulShutdown(); process.exit(0); });
    logger.info('interactive session start');
    // Simple loop: choose chapter -> enter term -> search -> review -> select -> generate section (optional)
    const chapterId = await this.ask('Kapitel-ID (z.B. 01-overview): ');
    const term = await this.ask('Suchbegriff: ');
    const alpha = parseFloat((await this.ask('Alpha (0.5-0.95, Enter=0.7): ')) || '0.7');
    const limit = parseInt((await this.ask('Max Ergebnisse (Enter=10): ')) || '10', 10);
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
    const { printResults } = require('./review');
    printResults(results);
  }

  async handleGracefulShutdown() {
    logger.warn('interactive shutdown');
    try { await this.stateManager.saveState(); } catch {}
  }

  async searchEmbedFilter(term, { alpha = 0.7, limit = 10 } = {}) {
    const cfg = require('../config/config');
    const vec = await embedText(term, cfg.embeddings.size);
    const qc = new QdrantClient();
    const base = await qc.searchPoints(cfg.qdrant.collection, vec, { limit, with_payload: true });
    const filter = basicFilter(term);
    const filtered = await qc.searchPoints(cfg.qdrant.collection, vec, { limit, filter, with_payload: true });
    return mergeWeighted(base, filtered, alpha).slice(0, limit);
  }

  ask(prompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(prompt, (ans) => { rl.close(); resolve(ans); }));
  }
}

module.exports = { ChatInterface };
