const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('path');
const { validateChapterStates } = require('../src/state/state-validator');

test('validateChapterStates can fix minimal issues', async () => {
  const tmp = path.resolve('.tmp-test-chapters');
  await fs.remove(tmp);
  const dir = path.join(tmp, 'chapter-states');
  await fs.mkdirp(dir);
  // Create an invalid chapter state with missing required props
  await fs.writeJson(path.join(dir, '01-overview.json'), { foo: 'bar' }, { spaces: 2 });

  const res1 = await validateChapterStates(dir);
  assert.equal(res1.valid, false);

  const res2 = await validateChapterStates(dir, { fix: true });
  assert.equal(res2.valid, true);
  const files = await fs.readdir(dir);
  assert.ok(files.includes('01-overview.json'));
  const fixed = await fs.readJson(path.join(dir, '01-overview.json'));
  assert.equal(fixed.chapterId, '01-overview');
  assert.ok(Array.isArray(fixed.completedSections));

  await fs.remove(tmp);
});
