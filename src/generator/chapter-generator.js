const logger = require('../utils/logger');
const { generateSection } = require('./section-generator');
const { seedRetrievalForChapter } = require('./batch-generator');

async function generateChapter({ stateManager, chapterId, sections = [], seedRetrieval = false, alpha = 0.7, limit = 10, seedTop = 3 }) {
  if (!chapterId) throw new Error('chapterId is required');
  const list = Array.isArray(sections) ? sections : [];
  const results = [];
  if (seedRetrieval) {
    try {
      const seeded = await seedRetrievalForChapter({ chapterId, alpha, limit, seedTop });
      if (seeded.seeded) logger.info('seeded retrieval', { chapterId, count: seeded.count });
    } catch (e) {
      logger.warn('seeding failed', { chapterId, error: e.message });
    }
  }
  for (const sectionName of list) {
    const res = await generateSection({ stateManager, chapterId, sectionName });
    results.push(res);
  }
  logger.info('Chapter generated', { chapterId, sections: list.length });
  return results;
}

module.exports = { generateChapter };
