"use strict";

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

test('StatefulInteractiveWorkflow runs phases and updates state', async () => {
  const tmp = path.join(__dirname, 'tmp-workflow');
  await fs.remove(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  await fs.mkdirp(stateDir);
  await fs.mkdirp(outputsDir);

  const cfgPath = path.join(__dirname, '..', 'src', 'config', 'config.js');
  // Patch env for this test run so StateManager uses our temp dirs via process.env
  process.env.OUTPUTS_DIR = outputsDir;
  process.env.STATE_DIR = stateDir;

  const { StateManager } = require('../src/state/state-manager');
  const sm = new StateManager(stateDir);
  await sm.initializeState({});

  const { StatefulInteractiveWorkflow } = require('../src/interactive/interactive-workflow');
  const wf = new StatefulInteractiveWorkflow(sm, null);
  await wf.reviewEBookStructure();
  await wf.interactiveChapterGeneration({ id: '01-overview' });

  const st = await sm.getCurrentState();
  assert.ok(st);
  assert.ok(st.currentPhase);
  assert.strictEqual(st.currentPhase.phase, 'IDLE');

  // Chapter state should be marked REVIEWED
  const chFile = path.join(stateDir, 'chapter-states', '01-overview.json');
  assert.ok(await fs.pathExists(chFile));
  const chState = await fs.readJson(chFile);
  assert.strictEqual(chState.status, 'REVIEWED');

  // At least one checkpoint should exist
  const cpDir = path.join(stateDir, 'checkpoints');
  const cps = (await fs.pathExists(cpDir)) ? (await fs.readdir(cpDir)).filter(f => f.endsWith('.json')) : [];
  assert.ok(cps.length >= 1);
});
