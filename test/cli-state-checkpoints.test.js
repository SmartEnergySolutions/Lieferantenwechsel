"use strict";

const assert = require("assert");
const { test } = require("node:test");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const { spawnSync } = require("child_process");

function runCli(cwd, env, args = []) {
  const res = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], { cwd, env: { ...process.env, ...env } });
  const out = res.stdout.toString();
  const err = res.stderr.toString();
  return { code: res.status, out, err };
}

test("cli state:checkpoints lists created checkpoints", async () => {
  const cwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lw-cli-cp-"));
  const stateDir = path.join(tmp, "state");
  await fs.mkdirp(path.join(stateDir, "checkpoints"));
  const sample = { checkpointId: "cp_123", createdAt: new Date().toISOString(), type: "MANUAL", description: "test" };
  await fs.writeJson(path.join(stateDir, "checkpoints", "cp_123.json"), sample, { spaces: 2 });
  const { code, out, err } = runCli(cwd, { STATE_DIR: stateDir }, ["state:checkpoints"]);
  assert.equal(code, 0, err);
  const list = JSON.parse(out);
  assert.ok(Array.isArray(list) && list.length >= 1);
  const found = list.find((e) => e.id === "cp_123");
  assert.ok(found, "checkpoint cp_123 present");
});
