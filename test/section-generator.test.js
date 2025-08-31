const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs-extra');
const { StateManager } = require('../src/state/state-manager');
const { SessionManager } = require('../src/interactive/session-manager');
const { generateSection } = require('../src/generator/section-generator');

test('section generator creates file and updates chapter state', async () => {
  const tmp = path.resolve('.tmp-test-gen');
  await fs.remove(tmp);
  await fs.mkdirp(tmp);
  const stateDir = path.join(tmp, 'state');
  const outputsDir = path.join(tmp, 'outputs');
  const origCwd = process.cwd();
  process.chdir(tmp);

  // avoid autosave
  process.env.AUTO_SAVE_INTERVAL = '600000';

  let sm;
  try {
    sm = new StateManager(stateDir);
    await sm.initializeState({});
    const ses = new SessionManager(sm);
    // add a decision with selected items so generator has something to use
    const results = [
      { id: 1, payload: { source_document: 'Spec-ANMELD.md', chunk_type: 'pseudocode_flow', content: 'ANMELD details...' } },
      { id: 2, payload: { source_document: 'Process-Fristen.md', chunk_type: 'structured_table', content: 'Fristen...' } }
    ];
    const d = await ses.addPendingDecision('01-overview', {
      type: 'EMBEDDED_SEARCH_SELECTION',
      context: { term: 'ANMELD', results },
    });
    await ses.resolveDecision('01-overview', d.decisionId, { selected: [0, 1], approved: true });

    const res = await generateSection({ stateManager: sm, chapterId: '01-overview', sectionName: 'Testabschnitt' });
    assert.ok(await fs.pathExists(res.filePath));

    const chapterFile = path.join(stateDir, 'chapter-states', '01-overview.json');
    const chapter = await fs.readJson(chapterFile);
    assert.ok(Array.isArray(chapter.completedSections));
    assert.ok(chapter.completedSections.find(s => s.sectionName === 'Testabschnitt'));

    // outputs folder in tmp
    const files = await fs.readdir(outputsDir);
    assert.ok(files.length >= 1);
  } finally {
    try { if (sm) sm.stopAutoSave(); } catch {}
    process.chdir(origCwd);
    await fs.remove(tmp);
  }
});
