const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const {
  toTitle,
  anchorFor,
  buildAnchors,
  resolveRefs,
  validateCrossRefs,
  renderCrossRef,
} = require('../src/export/crossrefs');

test('toTitle and anchorFor generate expected values', () => {
  assert.equal(toTitle('01-overview__deep-dive.md'), 'Overview  Deep Dive'.replace('  ', ' '));
  assert.equal(anchorFor('Deep Dive! Section'), 'deep-dive-section');
});

test('buildAnchors and resolveRefs work together', async () => {
  const tmp = path.join(__dirname, 'tmp-bundle');
  const outputs = path.join(tmp, 'outputs');
  await fs.remove(tmp);
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.mkdirp(path.join(outputs, '02-details'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__intro.md'), '# Intro\n\nsiehe [[ref:02-details__deep-dive]]');
  await fs.writeFile(path.join(outputs, '02-details', '02-details__deep-dive.md'), '# Deep Dive');
  const files = [];
  for (const dir of ['01-overview', '02-details']) {
    const entries = await fs.readdir(path.join(outputs, dir));
    for (const f of entries) files.push({ chapter: dir, file: f, full: path.join(outputs, dir, f) });
  }
  const anchors = buildAnchors(files);
  const intro = await fs.readFile(path.join(outputs, '01-overview', '01-overview__intro.md'), 'utf-8');
  const rendered = await resolveRefs(intro, anchors);
  assert.ok(rendered.includes('](#details-deep-dive)'));
});

test('renderCrossRef uses template when provided', () => {
  const tpl = 'Siehe {{section}} (Anker: #{{anchor}})';
  const s = renderCrossRef('Deep Dive', 'details-deep-dive', tpl);
  assert.equal(s, 'Siehe Deep Dive (Anker: #details-deep-dive)');
});

test('validateCrossRefs finds unresolved references', async () => {
  const tmp = path.join(__dirname, 'tmp-bundle');
  const outputs = path.join(tmp, 'outputs');
  await fs.remove(tmp);
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__intro.md'), '# Intro\n\n[[ref:missing-section]]');
  const res = await validateCrossRefs({ outputsDir: outputs });
  assert.equal(res.valid, false);
  assert.equal(res.totalRefs, 1);
  assert.equal(res.unresolved.length, 1);
});
