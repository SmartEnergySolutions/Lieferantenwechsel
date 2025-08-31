const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { validateConsistency } = require('../src/state/state-validator');

async function writeJson(file, obj) {
  await fs.mkdirp(path.dirname(file));
  await fs.writeJson(file, obj, { spaces: 2 });
}

test('consistency validator finds mismatches and passes when corrected', async () => {
  const tmp = path.join(__dirname, 'tmp-validator', 'consistency');
  await fs.remove(tmp);
  const stateDir = tmp;
  const chapterDir = path.join(stateDir, 'chapter-states');
  await fs.mkdirp(chapterDir);

  // current state marking two chapters completed
  await writeJson(path.join(stateDir, 'current-generation.json'), {
    generationId: 'gen1',
    status: 'IN_PROGRESS',
    currentPhase: { phase: 'WRITING', chapterId: '02-missing' },
    completedChapters: ['01-overview', '02-missing'],
    globalSettings: { autoSaveInterval: 30000 },
    userPreferences: { searchStrategy: { alpha: 0.7 }, contentPreferences: {} },
    statistics: {}
  });

  // Only one chapter state exists and it's not completed
  await writeJson(path.join(chapterDir, '01-overview.json'), {
    chapterId: '01-overview',
    status: 'IN_PROGRESS',
    pendingDecisions: [{ decisionId: 'dup-1' }],
    completedDecisions: []
  });
  await writeJson(path.join(chapterDir, '03-other.json'), {
    chapterId: '03-other',
    status: 'COMPLETED',
    pendingDecisions: [{ decisionId: 'dup-1' }], // duplicate with 01-overview
    completedDecisions: []
  });

  const res1 = await validateConsistency(stateDir);
  assert.equal(res1.valid, false);
  assert.ok(res1.problems.some(p => p.includes('completed chapter missing state file: 02-missing')));
  assert.ok(res1.problems.some(p => p.includes("chapter 01-overview listed as completed")));
  assert.ok(res1.problems.some(p => p.includes('is COMPLETED but has')));
  assert.ok(res1.problems.some(p => p.includes("duplicate decisionId 'dup-1'")));
  assert.ok(res1.problems.some(p => p.includes("currentPhase references chapter '02-missing'")));

  // Fix issues
  await writeJson(path.join(chapterDir, '02-missing.json'), { chapterId: '02-missing', status: 'COMPLETED', pendingDecisions: [], completedDecisions: [] });
  await writeJson(path.join(chapterDir, '01-overview.json'), { chapterId: '01-overview', status: 'COMPLETED', pendingDecisions: [], completedDecisions: [] });
  await writeJson(path.join(chapterDir, '03-other.json'), { chapterId: '03-other', status: 'COMPLETED', pendingDecisions: [], completedDecisions: [{ decisionId: 'unique-2' }] });
  await writeJson(path.join(stateDir, 'current-generation.json'), {
    generationId: 'gen1',
    status: 'IN_PROGRESS',
    currentPhase: { phase: 'WRITING', chapterId: '01-overview' },
  completedChapters: ['01-overview', '02-missing', '03-other'],
    globalSettings: { autoSaveInterval: 30000 },
    userPreferences: { searchStrategy: { alpha: 0.7 }, contentPreferences: {} },
    statistics: {}
  });

  const res2 = await validateConsistency(stateDir);
  assert.equal(res2.valid, true);
  assert.equal(res2.problems.length, 0);
});
