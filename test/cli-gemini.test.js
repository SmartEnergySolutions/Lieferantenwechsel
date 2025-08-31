"use strict";

const assert = require("assert");
const { test } = require("node:test");
const path = require("path");
const { spawnSync } = require("child_process");

function runCli(cwd, args = []) {
  const res = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], { cwd, env: process.env });
  return { code: res.status, out: res.stdout.toString(), err: res.stderr.toString() };
}

test("gemini:generate returns content without API key", async () => {
  const { code, out } = runCli(process.cwd(), ["gemini:generate", "--prompt=Test Abschnitt", "--chapter=01-overview"]);
  assert.equal(code, 0);
  assert.ok(out.includes("# Section") || out.includes("Generated (model="));
});
