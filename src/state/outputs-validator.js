const fs = require('fs-extra');
const path = require('path');

function deriveSectionNameFromFile(chapterId, file) {
  // Expect pattern: <chapterId>__<slug>.md
  const m = file.match(new RegExp(`^${chapterId}__(.+)\\.md$`, 'i'));
  if (!m) return file.replace(/\.(md|markdown)$/i, '');
  const slug = m[1];
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function validateOutputsAgainstState({ stateDir, outputsDir, fix = false }) {
  const chaptersDir = path.join(stateDir, 'chapter-states');
  const exists = await fs.pathExists(chaptersDir);
  const problems = [];
  const details = {
    staleRefs: [], // references in state that point to missing files
    orphanFiles: [], // files without state reference
    filesAddedToState: [], // when fixed, new completedSections entries created
    refsRemoved: [], // when fixed, removed stale completedSections entries
    filesWritten: [],
  };
  if (!exists) return { valid: true, problems: [], details };
  const chapterFiles = (await fs.readdir(chaptersDir)).filter(f => f.endsWith('.json'));
  for (const f of chapterFiles) {
    const chapPath = path.join(chaptersDir, f);
    let cs;
    try { cs = await fs.readJson(chapPath); } catch { continue; }
    const chapterId = cs.chapterId || f.replace(/\.json$/, '');
    const outDir = path.join(outputsDir, chapterId);
    const haveOut = await fs.pathExists(outDir);
    const outFiles = haveOut ? (await fs.readdir(outDir)).filter(x => /\.(md|markdown)$/i.test(x)) : [];
    const refs = Array.isArray(cs.completedSections) ? cs.completedSections : [];
    const refFiles = new Set(refs.map(r => r?.generatedContent?.contentFile).filter(Boolean));

    // stale references
    for (const rf of refFiles) {
      const full = path.join(outDir, rf);
      if (!await fs.pathExists(full)) {
        problems.push(`${chapterId}: missing output file for reference ${rf}`);
        details.staleRefs.push({ chapterId, file: rf });
        if (fix) {
          cs.completedSections = refs.filter(r => r?.generatedContent?.contentFile !== rf);
          details.refsRemoved.push({ chapterId, file: rf });
        }
      }
    }

    // orphan files: present on disk but not referenced
    for (const ofile of outFiles) {
      if (!refFiles.has(ofile)) {
        problems.push(`${chapterId}: orphan output file not recorded in state ${ofile}`);
        details.orphanFiles.push({ chapterId, file: ofile });
        if (fix) {
          const sectionName = deriveSectionNameFromFile(chapterId, ofile);
          cs.completedSections = cs.completedSections || [];
          cs.completedSections.push({
            sectionName,
            completedAt: new Date().toISOString(),
            generatedContent: { contentFile: ofile },
            searchResults: { totalResults: 0, selectedResultIds: [] },
          });
          details.filesAddedToState.push({ chapterId, file: ofile, sectionName });
        }
      }
    }

    if (fix && (details.refsRemoved.length || details.filesAddedToState.length)) {
      try { await fs.writeJson(chapPath, cs, { spaces: 2 }); details.filesWritten.push(chapPath); } catch {}
    }
  }
  return { valid: problems.length === 0, problems, details };
}

module.exports = { validateOutputsAgainstState };
