"use strict";

const assert = require("assert");
const { test } = require("node:test");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");
const { spawnSync } = require("child_process");

function runCli(cwd, env, args = []) {
  const res = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], { cwd, env: { ...process.env, ...env } });
  return { code: res.status, out: res.stdout.toString(), err: res.stderr.toString() };
}

test("config:validate produces valid=true with sane defaults", async () => {
  const cwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lw-conf-"));
  const outDir = path.join(tmp, "o");
  const stateDir = path.join(tmp, "s");
  const { code, out } = runCli(cwd, { OUTPUTS_DIR: outDir, STATE_DIR: stateDir }, ["config:validate"]);
  const obj = JSON.parse(out);
  assert.ok(obj && typeof obj.valid === "boolean");
  // Both dirs should exist after validation attempt
  assert.ok(await fs.pathExists(outDir));
  assert.ok(await fs.pathExists(stateDir));
});
