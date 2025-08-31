"use strict";

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { spawnSync } = require('child_process');

function runCli(cwd, args = [], extraEnv = {}) {
  const res = spawnSync(process.execPath, [path.join(cwd, 'src/cli.js'), ...args], {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'pipe'
  });
  return { code: res.status, out: res.stdout.toString(), err: res.stderr.toString() };
}

test('End-to-End Pipeline Test für ein einzelnes Kapitel', async () => {
  const cwd = process.cwd();
  const tmp = path.join(__dirname, 'tmp-e2e');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  const state = path.join(tmp, 'state');
  await fs.mkdirp(outputs);
  await fs.mkdirp(state);

  // Generate two sections for chapter 01-overview
  const sections = 'ANMELD Nachricht – Struktur, Marktrollen und Datenflüsse';
  const g = runCli(cwd, ['generate:chapter', `--chapter=01-overview`, `--sections=${sections}`], {
    OUTPUTS_DIR: outputs,
    STATE_DIR: state,
  });
  assert.equal(g.code, 0, g.err);

  // Export bundle
  const bundlePath = path.join(outputs, 'bundle', 'book.md');
  const b = runCli(cwd, ['export:bundle', `--title=E2E`, `--to=${bundlePath}`], {
    OUTPUTS_DIR: outputs,
    STATE_DIR: state,
  });
  assert.equal(b.code, 0, b.err);
  assert.ok(await fs.pathExists(bundlePath));

  // Validate crossrefs (should be valid: no refs yet)
  const vr = runCli(cwd, ['outputs:crossrefs'], { OUTPUTS_DIR: outputs, STATE_DIR: state });
  assert.equal(vr.code, 0, vr.out);
});

test('Multi-Chapter Generation Test', async () => {
  const cwd = process.cwd();
  const tmp = path.join(__dirname, 'tmp-e2e-multi');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  const state = path.join(tmp, 'state');
  await fs.mkdirp(outputs);
  await fs.mkdirp(state);

  // Generate one section per chapter
  const g = runCli(cwd, ['generate:all', '--sections-limit=1'], { OUTPUTS_DIR: outputs, STATE_DIR: state });
  assert.equal(g.code, 0, g.err);
  // Count chapter directories created in outputs
  const chapters = (await fs.readdir(outputs)).filter(f => /^(\d{2}-|\d{2}_|\d{2})/.test(f));
  assert.ok(chapters.length >= 8, 'Expected at least 8 chapter output folders');
});
