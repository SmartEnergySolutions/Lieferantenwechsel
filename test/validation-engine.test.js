"use strict";

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { runValidationEngine } = require('../src/core/validation-engine');

test('Validation Engine aggregates checks and writes report', async () => {
  const tmp = path.join(__dirname, 'tmp-validation-engine');
  await fs.remove(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  await fs.mkdirp(stateDir);
  await fs.mkdirp(path.join(outputsDir, '01-overview'));

  // create a valid minimal output and matching state
  const file = '01-overview__intro.md';
  await fs.writeFile(path.join(outputsDir, '01-overview', file), '# Intro');
  await fs.mkdirp(path.join(stateDir, 'chapter-states'));
  await fs.writeJson(path.join(stateDir, 'chapter-states', '01-overview.json'), {
    chapterId: '01-overview',
    status: 'IN_PROGRESS',
    completedSections: [{ sectionName: 'Intro', generatedContent: { contentFile: file } }]
  }, { spaces: 2 });

  const res = await runValidationEngine({ stateDir, outputsDir, fix: false, minSectionsPerChapter: 1 });
  assert.ok(typeof res.valid === 'boolean');
  assert.ok(await fs.pathExists(path.join(stateDir, 'validation', 'last-report.json')));
});
