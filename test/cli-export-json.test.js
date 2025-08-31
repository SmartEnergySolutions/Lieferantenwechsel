"use strict";

const assert = require("assert");
const { test } = require("node:test");
const fs = require("fs-extra");
const path = require("path");
const { spawnSync } = require("child_process");

function runCli(cwd, args = []) {
  const res = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], { cwd, env: process.env });
  return { code: res.status, out: res.stdout.toString(), err: res.stderr.toString() };
}

test("export:json produces a manifest file", async () => {
  const cwd = process.cwd();
  const outFile = path.join(cwd, "outputs", "bundle", "book.json");
  await fs.remove(outFile).catch(() => {});
  const { code } = runCli(cwd, ["export:json", "--title=Test", `--to=${outFile}`]);
  assert.equal(code, 0);
  const exists = await fs.pathExists(outFile);
  assert.ok(exists, "book.json not created");
  const manifest = await fs.readJson(outFile);
  assert.ok(manifest && manifest.chapters && Array.isArray(manifest.chapters));
});
