const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { StateManager } = require('../src/state/state-manager');
const { SessionManager } = require('../src/interactive/session-manager');

(async () => {
  const tmpDir = path.resolve('.tmp-test-session');
  await fs.remove(tmpDir);
  await fs.mkdirp(tmpDir);
  const stateDir = path.join(tmpDir, 'state');

  // Avoid autosave firing during test
  process.env.AUTO_SAVE_INTERVAL = '600000';

  const sm = new StateManager(stateDir);
  await sm.initializeState({});
  const ses = new SessionManager(sm);

  try {
    const d = await ses.addPendingDecision('01-overview', { type: 'TEST', context: { foo: 'bar' } });
    const list = await ses.listPendingDecisions();
    assert.ok(list.find((x) => x.decisionId === d.decisionId));

    await ses.resolveDecision('01-overview', d.decisionId, { approved: true });
    const list2 = await ses.listPendingDecisions();
    assert.ok(!list2.find((x) => x.decisionId === d.decisionId));
  } finally {
    sm.stopAutoSave();
    await fs.remove(tmpDir);
  }
})();
