const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { coverageReport } = require('../src/state/coverage-validator');

const CHAPTERS = [ { id: '01-overview' }, { id: '02-contract-conclusion' } ];

test('coverage report flags shortfalls and passes when enough files exist', async () => {
  const tmp = path.join(__dirname, 'tmp-coverage');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.mkdirp(path.join(outputs, '02-contract-conclusion'));
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__a.md'), '# A');
  const res1 = await coverageReport({ outputsDir: outputs, chapters: CHAPTERS, minSectionsPerChapter: 2 });
  assert.equal(res1.valid, false);
  await fs.writeFile(path.join(outputs, '02-contract-conclusion', '02-contract-conclusion__b.md'), '# B');
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__c.md'), '# C');
  const res2 = await coverageReport({ outputsDir: outputs, chapters: CHAPTERS, minSectionsPerChapter: 1 });
  assert.equal(res2.valid, true);
});

test('coverage uses per-chapter requiredSections when provided', async () => {
  const tmp = path.join(__dirname, 'tmp-coverage');
  await fs.remove(tmp);
  const outputs = path.join(tmp, 'outputs');
  await fs.mkdirp(path.join(outputs, '01-overview'));
  await fs.mkdirp(path.join(outputs, '02-contract-conclusion'));
  // Only one file for 01-overview, two for 02-contract-conclusion
  await fs.writeFile(path.join(outputs, '01-overview', '01-overview__a.md'), '# A');
  await fs.writeFile(path.join(outputs, '02-contract-conclusion', '02-contract-conclusion__b.md'), '# B');
  await fs.writeFile(path.join(outputs, '02-contract-conclusion', '02-contract-conclusion__c.md'), '# C');

  const chapters = [
    { id: '01-overview', validationCriteria: { requiredSections: 2 } },
    { id: '02-contract-conclusion', validationCriteria: { requiredSections: 2 } },
  ];

  const res = await coverageReport({ outputsDir: outputs, chapters, minSectionsPerChapter: 1 });
  assert.equal(res.valid, false); // 01-overview requires 2 but has 1
  const overview = res.chapters.find(c => c.chapterId === '01-overview');
  assert.equal(overview.required, 2);
  assert.equal(overview.have, 1);
  const cc = res.chapters.find(c => c.chapterId === '02-contract-conclusion');
  assert.equal(cc.required, 2);
  assert.equal(cc.have, 2);
  assert.equal(cc.ok, true);
});
