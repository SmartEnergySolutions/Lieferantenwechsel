const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

test('template engine renders placeholders for beginner level', async () => {
  const { renderSection } = require('../src/generation/template-engine');
  const md = await renderSection({ chapter: { id: '01-overview', title: 'Überblick', level: 'beginner' }, sectionName: 'Intro', content: 'Hallo' });
  assert.ok(md.includes('# Überblick'));
  assert.ok(md.includes('## Abschnitt: Intro'));
  assert.ok(md.includes('Hallo'));
});

test('section-generator uses templates and writes file', async () => {
  const tmp = path.join(__dirname, 'tmp-template');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  const state = path.join(tmp, 'state');
  process.env.OUTPUTS_DIR = outputs;
  process.env.STATE_DIR = state;
  const { StateManager } = require('../src/state/state-manager');
  const sm = new StateManager(state);
  await sm.initializeState({});
  const { generateSection } = require('../src/generator/section-generator');
  const res = await generateSection({ stateManager: sm, chapterId: '01-overview', sectionName: 'Intro Abschnitt' });
  assert.ok(await fs.pathExists(res.filePath));
  const md = await fs.readFile(res.filePath, 'utf-8');
  assert.ok(md.includes('Intro Abschnitt'));
  assert.ok(md.includes('# 01-overview') || md.includes('# Überblick'));
});
