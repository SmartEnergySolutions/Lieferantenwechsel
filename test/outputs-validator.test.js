const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { validateOutputsAgainstState } = require('../src/state/outputs-validator');

async function writeJson(file, obj) { await fs.mkdirp(path.dirname(file)); await fs.writeJson(file, obj, { spaces: 2 }); }

test('outputs validator detects stale refs and orphans and can fix', async () => {
  const tmp = path.join(__dirname, 'tmp-outputs');
  await fs.remove(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  const csDir = path.join(stateDir, 'chapter-states');
  await fs.mkdirp(csDir);
  await fs.mkdirp(path.join(outputsDir, '01-overview'));

  // state references a missing file and lacks a real file reference
  await writeJson(path.join(csDir, '01-overview.json'), {
    chapterId: '01-overview',
    status: 'IN_PROGRESS',
    completedSections: [ { sectionName: 'Old', generatedContent: { contentFile: '01-overview__old.md' } } ]
  });
  // actual file present but not referenced
  await fs.writeFile(path.join(outputsDir, '01-overview', '01-overview__intro.md'), '# Intro');

  const res1 = await validateOutputsAgainstState({ stateDir, outputsDir });
  assert.equal(res1.valid, false);
  assert.ok(res1.problems.find(p => p.includes('missing output file')));
  assert.ok(res1.problems.find(p => p.includes('orphan output file')));

  const res2 = await validateOutputsAgainstState({ stateDir, outputsDir, fix: true });
  assert.equal(res2.valid, false); // still reports problems from this run
  // After fix, re-run should be valid
  const res3 = await validateOutputsAgainstState({ stateDir, outputsDir });
  assert.equal(res3.valid, true);
});
