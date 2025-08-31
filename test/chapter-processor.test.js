"use strict";

const { test } = require('node:test');
const assert = require('assert');
const path = require('path');
const fs = require('fs-extra');
const { StateManager } = require('../src/state/state-manager');
const { ChapterProcessor } = require('../src/core/chapter-processor');

test('Stateful Interactive Chapter Processor generates sections with checkpoints', async () => {
  const tmp = path.join(__dirname, 'tmp-chapter-processor');
  await fs.remove(tmp);
  process.env.STATE_DIR = path.join(tmp, 'state');
  process.env.OUTPUTS_DIR = path.join(tmp, 'outputs');
  const sm = new StateManager(process.env.STATE_DIR);
  await sm.initializeState({});

  const cp = new ChapterProcessor(sm);
  const res = await cp.processChapter({ chapterId: '01-overview', sectionsLimit: 2 });
  assert.ok(Array.isArray(res.files) && res.files.length === 2);

  // ensure checkpoints were created
  const files = (await fs.readdir(sm.checkpointsDir)).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 2);
});
