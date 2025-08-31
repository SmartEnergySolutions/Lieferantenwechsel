"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs-extra");
const path = require("path");
const { StateManager } = require("../src/state/state-manager");

const TMP = path.join(__dirname, ".tmp-state-test");

async function rmrf(p) { try { await fs.remove(p); } catch {} }

test("StateManager initializes, checkpoints, and recovers", async () => {
  await rmrf(TMP);
  await fs.mkdirp(TMP);
  try {
    const sm = new StateManager(TMP);
    const st = await sm.initializeState({});
    assert.match(st.generationId, /^gen_/);
    const cp = await sm.createCheckpoint("test CP", "AUTO");
    assert.match(cp, /^cp_/);
    // mutate state and save
    const s1 = await sm.getCurrentState();
    s1.status = "PAUSED";
    await sm.saveState(s1);
    // recover from checkpoint -> status should revert
    const s2 = await sm.recoverFromCheckpoint(cp);
    assert.equal(s2.status, "INITIALIZED");
  } finally {
    await rmrf(TMP);
  }
});
