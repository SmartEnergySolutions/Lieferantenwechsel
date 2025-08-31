const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const { StateManager } = require('../src/state/state-manager');

// Node.js test runner will execute this file via `node --test`

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const tmpDir = path.resolve('.tmp-test');
  await fs.remove(tmpDir);
  await fs.mkdirp(tmpDir);

  const stateDir = path.join(tmpDir, 'state');
  process.env.UPLOAD_PATH = path.join(tmpDir, 'uploads');
  process.env.AUTO_SAVE_INTERVAL = '50';

  const sm = new StateManager(stateDir);
  // 1) Initialize
  const init = await sm.initializeState({ detailLevel: 'standard' });
  assert.ok(init.generationId.startsWith('gen_'));
  assert.equal(init.status, 'INITIALIZED');

  // 2) Simulate interruption: trigger graceful shutdown
  await sm.handleGracefulShutdown();
  const stateAfter = await sm.getCurrentState();
  assert.ok(stateAfter.currentPhase.lastCheckpoint);

  // 3) Recovery
  const rec = await sm.recoverFromCrash();
  assert.equal(rec.recovered, true);

  // 4) Validate state integrity
  const final = await sm.getCurrentState();
  assert.ok(final.generationId);
  assert.ok(final.lastUpdate);

  // Cleanup
  await fs.remove(tmpDir);
})();
