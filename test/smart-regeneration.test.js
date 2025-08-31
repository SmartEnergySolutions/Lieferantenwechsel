"use strict";

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

test('improveMarkdown ensures sources and raises word count', async () => {
  const { improveMarkdown } = require('../src/core/smart-regeneration');
  const base = '# Title\n\nKurzer Text.';
  const out = await improveMarkdown(base, { ensureSources: true, minWords: 60, attempts: 2 });
  assert.match(out, /Quellen:\n- /);
  const words = out.split(/\s+/).filter(Boolean).length;
  assert.ok(words >= 60);
});

test('runSmartRegeneration improves low-quality sections and updates chapter state', async () => {
  const tmp = path.join(__dirname, 'tmp-smart');
  await fs.remove(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  await fs.mkdirp(path.join(stateDir, 'chapter-states'));
  await fs.mkdirp(path.join(outputsDir, '01-overview'));

  process.env.STATE_DIR = stateDir;
  process.env.OUTPUTS_DIR = outputsDir;

  // Prepare a low-quality section
  const fileName = '01-overview__kurz.md';
  await fs.writeFile(path.join(outputsDir, '01-overview', fileName), '# 01-overview – Kurz\n\nInhalt folgt...');
  await fs.writeJson(path.join(stateDir, 'chapter-states', '01-overview.json'), {
    chapterId: '01-overview',
    completedSections: [{ sectionName: 'Kurz', generatedContent: { contentFile: fileName, qualityScore: 0.1 } }]
  }, { spaces: 2 });

  const { StateManager } = require('../src/state/state-manager');
  const sm = new StateManager(stateDir);
  await sm.initializeState({});

  const { runSmartRegeneration } = require('../src/core/smart-regeneration');
  const rep = await runSmartRegeneration({ stateManager: sm, minScore: 0.8, chapterId: '01-overview', maxImprovements: 2 });
  assert.ok(rep.improved >= 1);

  const ch = await fs.readJson(path.join(stateDir, 'chapter-states', '01-overview.json'));
  const updated = ch.completedSections[0].generatedContent.qualityScore;
  assert.ok(updated >= 0.4); // improved from 0.1 to something higher
});
