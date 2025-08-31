const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const { generateSection } = require('./section-generator');
const { QdrantClient } = require('../retrieval/qdrant-client');
const { embedText } = require('../retrieval/embeddings');
const { basicFilter, mergeWeighted } = require('../retrieval/search-strategies');
const { loadQuery, saveQuery, incrementHit } = require('../retrieval/search-cache');
const cfg = require('../config/config');
const { SEARCH_QUERIES } = require('../config/search-queries');

async function sectionAlreadyExists(outputsDir, chapterId, sectionName) {
  const dir = path.join(outputsDir, chapterId);
  if (!(await fs.pathExists(dir))) return false;
  const safe = (sectionName || 'Abschnitt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const file = `${chapterId}__${safe}.md`;
  return await fs.pathExists(path.join(dir, file));
}

async function seedRetrievalForChapter({ chapterId, alpha = 0.7, limit = 10, seedTop = 3 }) {
  const queries = SEARCH_QUERIES[chapterId] || [];
  if (!queries.length) return { seeded: false, reason: 'no-queries' };
  const chaptersDir = path.join(cfg.state.dir, 'chapter-states');
  const chapterFile = path.join(chaptersDir, `${chapterId}.json`);
  let chapterState;
  try {
    chapterState = await fs.readJson(chapterFile);
  } catch (e) {
    // No chapter-state yet; create a minimal one
    chapterState = { chapterId, status: 'IN_PROGRESS', completedSections: [], pendingDecisions: [], completedDecisions: [], searchHistory: [] };
  }
  const qc = new QdrantClient();
  let seededCount = 0;
  for (const term of queries) {
    try {
      const vector = await embedText(term, cfg.embeddings.size);
      const cacheKey = { term, collection: cfg.qdrant.collection, strategy: 'embed+filter', alpha, limit };
      let merged;
      const cached = await loadQuery(cacheKey);
      if (cached && Array.isArray(cached.results)) {
        await incrementHit(cacheKey);
        merged = cached.results;
      } else {
        const base = await qc.searchPoints(cfg.qdrant.collection, vector, { limit, with_payload: true });
        const filter = basicFilter(term);
        const filtered = await qc.searchPoints(cfg.qdrant.collection, vector, { limit, filter, with_payload: true });
        merged = mergeWeighted(base, filtered, alpha).slice(0, limit);
        await saveQuery(cacheKey, merged);
      }
      const selectedIndices = Array.from({ length: Math.min(seedTop, merged.length) }, (_, i) => i);
      const selectedItems = selectedIndices.map(i => merged[i]).filter(Boolean);
      const selectedResultIds = selectedItems.map(it => it?.id).filter(id => id !== undefined);
      chapterState.searchHistory = chapterState.searchHistory || [];
      chapterState.searchHistory.push({
        decisionId: `auto_seed_${Date.now()}_${seededCount}`,
        type: 'AUTO_SEED',
        term,
        alpha,
        selectedIndices,
        selectedResultIds,
        selectedItems,
        count: selectedItems.length,
        decidedAt: new Date().toISOString(),
        strategy: 'embed+filter',
      });
      seededCount += 1;
    } catch (e) {
      // Qdrant may be unavailable; continue gracefully
      logger.warn('seed retrieval failed', { chapterId, error: e.message });
    }
  }
  await fs.mkdirp(path.dirname(chapterFile));
  await fs.writeJson(chapterFile, chapterState, { spaces: 2 });
  return { seeded: seededCount > 0, count: seededCount };
}

async function generateAll({ stateManager, chapters, outputsDir, skipExisting = true, sectionsLimitPerChapter = 0, seedRetrieval = false, alpha = 0.7, limit = 10, seedTop = 3 }) {
  const results = [];
  for (const ch of chapters) {
    if (seedRetrieval) {
      try {
        const seeded = await seedRetrievalForChapter({ chapterId: ch.id, alpha, limit, seedTop });
        if (seeded.seeded) logger.info('seeded retrieval', { chapterId: ch.id, count: seeded.count });
      } catch (e) {
        logger.warn('seeding failed', { chapterId: ch.id, error: e.message });
      }
    }
    const toGen = (Array.isArray(ch.sections) ? ch.sections : []).slice(0, sectionsLimitPerChapter > 0 ? sectionsLimitPerChapter : undefined);
    for (const sec of toGen) {
      if (skipExisting && await sectionAlreadyExists(outputsDir, ch.id, sec)) {
        logger.info('skip existing section', { chapterId: ch.id, section: sec });
        continue;
      }
      const res = await generateSection({ stateManager, chapterId: ch.id, sectionName: sec });
      results.push(res);
    }
  }
  return results;
}

module.exports = { generateAll, seedRetrievalForChapter };
