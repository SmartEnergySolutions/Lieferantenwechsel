const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { validateCurrentState } = require('../src/state/state-validator');

async function makeTempState(dir) {
  await fs.mkdirp(dir);
  const file = path.join(dir, 'current-generation.json');
  await fs.writeJson(file, {
    generationId: 'gen_test',
    status: 'INITIALIZED',
    currentPhase: { phase: 'INITIALIZATION' },
    // completedChapters missing on purpose
    globalSettings: { autoSaveInterval: 30000 },
    userPreferences: { searchStrategy: { alpha: 0.8 }, contentPreferences: {} },
    statistics: {}
  }, { spaces: 2 });
  return file;
}

test('state validator detects issues and can fix minimal problems', async () => {
  const tmp = path.join(__dirname, 'tmp-validator');
  await fs.remove(tmp);
  const file = await makeTempState(tmp);
  // Remove completedChapters to trigger a fix
  const json = await fs.readJson(file);
  delete json.completedChapters;
  await fs.writeJson(file, json, { spaces: 2 });

  const res1 = await validateCurrentState(file);
  assert.equal(res1.valid, false);
  assert.ok(Array.isArray(res1.problems));

  const res2 = await validateCurrentState(file, { fix: true });
  assert.equal(res2.valid, true);
  assert.equal(res2.fixed, true);

  const fixed = await fs.readJson(file);
  assert.ok(Array.isArray(fixed.completedChapters));
});
