"use strict";

const { test } = require('node:test');
const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const { StateManager } = require('../src/state/state-manager');
const { runEbookGenerator } = require('../src/core/ebook-generator');

test('Stateful Interactive E-Book Generator generates sections per chapter', async () => {
  const tmp = path.join(__dirname, 'tmp-ebook');
  await fs.remove(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  await fs.mkdirp(stateDir);
  process.env.STATE_DIR = stateDir;
  process.env.OUTPUTS_DIR = outputsDir;
  const sm = new StateManager(stateDir);
  await sm.initializeState({});
  const res = await runEbookGenerator({ stateManager: sm, sectionsLimit: 1 });
  assert.ok(res.total >= 8, 'expected at least one section per chapter');
  // ensure some outputs exist
  const dirs = (await fs.readdir(outputsDir)).filter((f) => /^(\d{2}-|\d{2}_|\d{2})/.test(f));
  assert.ok(dirs.length >= 8);
});
