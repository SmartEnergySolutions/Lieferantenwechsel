"use strict";

const { CHAPTERS } = require("../config/ebook-structure");
const { generateSection } = require("../generator/section-generator");

/**
 * runEbookGenerator
 * Iterates chapters and generates up to sectionsLimit per chapter using the provided StateManager.
 * Returns an object with generated file names per chapter.
 */
async function runEbookGenerator({ stateManager, sectionsLimit = 0, chapters = CHAPTERS } = {}) {
  const result = { files: {}, total: 0 };
  for (const ch of chapters) {
    const secs = Array.isArray(ch.sections) ? ch.sections.slice(0, sectionsLimit > 0 ? sectionsLimit : ch.sections.length) : [];
    for (const s of secs) {
      const r = await generateSection({ stateManager, chapterId: ch.id, sectionName: s });
      result.files[ch.id] = result.files[ch.id] || [];
      result.files[ch.id].push(r.fileName);
      result.total += 1;
    }
  }
  return result;
}

module.exports = { runEbookGenerator };
