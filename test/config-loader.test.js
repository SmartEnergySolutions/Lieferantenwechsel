const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

const tempJson = async (obj) => {
  const p = path.join(__dirname, 'tmp-config', `${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await fs.mkdirp(path.dirname(p));
  await fs.writeJson(p, obj, { spaces: 2 });
  return p;
};

test('config loader sets and reads active chapters', async () => {
  const file = await tempJson({ chapters: [
    { id: '01-overview', title: 'Overview', sections: ['A','B'], validationCriteria: { requiredSections: 2 } },
    { id: '02-contract', title: 'Contract', sections: [], validationCriteria: { requiredSections: 0 } }
  ]});
  const { loadFromFile, getActiveChapters, activeConfigPath } = require('../src/config/loader');
  const res = await loadFromFile(file);
  assert.equal(res.loaded ?? true, true);
  assert.ok(await fs.pathExists(activeConfigPath()));
  const { source, chapters } = await getActiveChapters();
  assert.equal(source, 'custom');
  const ch = chapters.find(c => c.id === '01-overview');
  assert.ok(ch);
  assert.equal(ch.sections.length, 2);
  assert.equal(ch.validationCriteria.requiredSections, 2);
});
