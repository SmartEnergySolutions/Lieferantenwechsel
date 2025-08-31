const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { validateConsistency } = require('../src/state/state-validator');

async function writeJson(file, obj) { await fs.mkdirp(path.dirname(file)); await fs.writeJson(file, obj, { spaces: 2 }); }

test('consistency detects orphan completed chapters and can fix by adding to current.completedChapters', async () => {
  const tmp = path.join(__dirname, 'tmp-consistency-orphans');
  await fs.remove(tmp);
  const stateDir = tmp;
  const csDir = path.join(stateDir, 'chapter-states');
  await fs.mkdirp(csDir);

  await writeJson(path.join(stateDir, 'current-generation.json'), {
    generationId: 'gen1', status: 'IN_PROGRESS', currentPhase: { phase: 'WRITING' },
    completedChapters: [], globalSettings: { autoSaveInterval: 30000 }, userPreferences: { searchStrategy: { alpha: 0.7 }, contentPreferences: {} }, statistics: {}
  });
  await writeJson(path.join(csDir, '01-overview.json'), { chapterId: '01-overview', status: 'COMPLETED', pendingDecisions: [] });

  const res1 = await validateConsistency(stateDir);
  assert.equal(res1.valid, false);
  assert.ok(res1.problems.find(p => p.includes('state is COMPLETED but not recorded')));

  const res2 = await validateConsistency(stateDir, { fix: true });
  assert.equal(res2.valid, false); // re-run will still show issues from first pass
  const res3 = await validateConsistency(stateDir);
  assert.equal(res3.valid, true);
});
