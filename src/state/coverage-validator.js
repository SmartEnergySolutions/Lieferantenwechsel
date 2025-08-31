const fs = require('fs-extra');
const path = require('path');

// Computes coverage per chapter. Required sections threshold is determined in this order:
// 1) chapter.validationCriteria.requiredSections (if provided)
// 2) global minSectionsPerChapter (argument)
// 3) default: 1
async function coverageReport({ outputsDir, chapters, minSectionsPerChapter = 1 }) {
  const results = [];
  let allMeet = true;
  for (const ch of chapters) {
    const dir = path.join(outputsDir, ch.id);
    const files = (await fs.pathExists(dir)) ? (await fs.readdir(dir)).filter(f => /\.(md|markdown)$/i.test(f)) : [];
    const required = Number.isFinite(ch?.validationCriteria?.requiredSections)
      ? ch.validationCriteria.requiredSections
      : (Number.isFinite(minSectionsPerChapter) ? minSectionsPerChapter : 1);
    const ok = files.length >= required;
    if (!ok) allMeet = false;
    results.push({ chapterId: ch.id, required, have: files.length, ok });
  }
  return { valid: allMeet, chapters: results };
}

module.exports = { coverageReport };
