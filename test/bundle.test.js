const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { bundleMarkdown, listMarkdownFiles } = require('../src/export/bundle');

test('bundle collects markdown and writes combined file', async () => {
  const tmp = path.join(__dirname, 'tmp-bundle');
  const outputs = path.join(tmp, 'outputs');
  await fs.remove(tmp);
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.mkdirp(path.join(outputs, '02-details'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__intro.md'), '# Intro\n\nText.');
  await fs.writeFile(path.join(outputs, '02-details', '02-details__deep-dive.md'), '# Deep Dive\n\nMore.');

  const files = await listMarkdownFiles(outputs);
  assert.equal(files.length, 2);
  const dest = path.join(tmp, 'bundle', 'book.md');
  const res = await bundleMarkdown({ outputsDir: outputs, destFile: dest, title: 'Test Book' });
  assert.equal(res.count, 2);
  const out = await fs.readFile(dest, 'utf-8');
  assert.ok(out.includes('# Test Book'));
  assert.ok(out.includes('## Inhalt'));
  assert.ok(out.includes('Intro'));
  assert.ok(out.includes('Deep Dive'));
});

test('bundle uses toc-template.md when present', async () => {
  const tmp = path.join(__dirname, 'tmp-bundle');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__a.md'), '# A\n\nInhalt A');
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__b.md'), '# B\n\nInhalt B');
  const tplDir = path.join(tmp, 'templates');
  await fs.mkdirp(tplDir);
  await fs.writeFile(path.join(tplDir, 'toc-template.md'), '## Mein Inhalt\n\n{{list}}\n');
  const prev = process.cwd();
  try {
    process.chdir(tmp);
    const dest = path.join(tmp, 'out.md');
    const res = await bundleMarkdown({ outputsDir: outputs, destFile: dest, title: 'X', includeTOC: true });
    const out = await fs.readFile(dest, 'utf-8');
    assert.ok(out.includes('## Mein Inhalt'));
  } finally {
    process.chdir(prev);
  }
});

test('bundle appends appendix templates when available', async () => {
  const tmp = path.join(__dirname, 'tmp-bundle');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__a.md'), '# A');
  const appDir = path.join(tmp, 'templates', 'appendix-templates');
  await fs.mkdirp(appDir);
  await fs.writeFile(path.join(appDir, 'x.md'), '# X');
  const prev = process.cwd();
  try {
    process.chdir(tmp);
    const dest = path.join(tmp, 'bundle2.md');
    await bundleMarkdown({ outputsDir: outputs, destFile: dest, title: 'T' });
    const out = await fs.readFile(dest, 'utf-8');
    assert.ok(out.includes('## Anhang'));
    assert.ok(out.includes('# X'));
  } finally {
    process.chdir(prev);
  }
});

test('bundle resolves [[ref:...]] cross-references to anchors', async () => {
  const tmp = path.join(__dirname, 'tmp-bundle');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.mkdirp(path.join(outputs, '02-details'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__intro.md'), '# Intro\n\nsiehe [[ref:02-details__deep-dive]]');
  await fs.writeFile(path.join(outputs, '02-details', '02-details__deep-dive.md'), '# Deep Dive');
  const dest = path.join(tmp, 'bundle', 'book.md');
  await bundleMarkdown({ outputsDir: outputs, destFile: dest, title: 'T' });
  const out = await fs.readFile(dest, 'utf-8');
  require('assert').ok(out.includes('](#details-deep-dive)'));
});
