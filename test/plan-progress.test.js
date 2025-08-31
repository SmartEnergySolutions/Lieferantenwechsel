"use strict";

const assert = require("assert");
const { test } = require("node:test");
const path = require("path");
const { spawnSync } = require("child_process");

function runCli(cwd, args = []) {
  const res = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], { cwd, env: process.env });
  return { code: res.status, out: res.stdout.toString(), err: res.stderr.toString() };
}

test("plan:progress returns JSON with percent", async () => {
  const cwd = process.cwd();
  const { code, out } = runCli(cwd, ["plan:progress"]);
  assert.equal(code, 0);
  const r = JSON.parse(out);
  assert.ok(typeof r.total === "number" && r.total > 0);
  assert.ok(typeof r.done === "number");
  assert.ok(typeof r.percent === "number");
  assert.ok(r.percent >= 0 && r.percent <= 100);
});
