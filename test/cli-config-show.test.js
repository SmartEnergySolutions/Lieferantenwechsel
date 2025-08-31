"use strict";

const assert = require("assert");
const { test } = require("node:test");
const path = require("path");
const { spawnSync } = require("child_process");

function runCli(cwd, env, args = []) {
  const res = spawnSync(process.execPath, [path.join(cwd, "src/cli.js"), ...args], { cwd, env: { ...process.env, ...env } });
  return { code: res.status, out: res.stdout.toString(), err: res.stderr.toString() };
}

test("config:show prints safe config", async () => {
  const cwd = process.cwd();
  const { code, out } = runCli(cwd, { OPENAI_API_KEY: "dummy-key" }, ["config:show"]);
  assert.equal(code, 0);
  const conf = JSON.parse(out);
  assert.equal(conf.embeddings.openai.apiKey, "set");
  assert.ok(conf.qdrant && conf.outputs && conf.state);
});
