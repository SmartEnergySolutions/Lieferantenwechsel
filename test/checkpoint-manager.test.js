"use strict";

const assert = require("assert");
const fs = require("fs");
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const { test, before, after } = require("node:test");
const { CheckpointManager } = require("../src/state/checkpoint-manager");

let tmpDir;

before(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lw-cp-"));
});

after(async () => {
  // best-effort cleanup
  try { await fse.remove(tmpDir); } catch {}
});

test("CheckpointManager list and get", async () => {
  const base = path.join(tmpDir, "checkpoints");
  await fse.mkdirp(base);
  const samples = [
    { id: "cp_1000", createdAt: "2025-01-01T00:00:00.000Z", type: "MANUAL", description: "a" },
    { id: "cp_2000", createdAt: "2025-01-01T00:10:00.000Z", type: "AUTO", description: "b" },
    { id: "cp_3000", createdAt: "2025-01-01T00:20:00.000Z", type: "EMERGENCY", description: "c" },
  ];
  for (const s of samples) {
    await fse.writeJson(path.join(base, `${s.id}.json`), { checkpointId: s.id, createdAt: s.createdAt, type: s.type, description: s.description }, { spaces: 2 });
  }
  const cm = new CheckpointManager(base);
  const list = await cm.list();
  assert.deepStrictEqual(list, ["cp_1000.json", "cp_2000.json", "cp_3000.json"], "files sorted lexicographically");
  const got = await cm.get("cp_3000");
  assert.equal(got.checkpointId, "cp_3000");
  assert.equal(got.type, "EMERGENCY");
});
