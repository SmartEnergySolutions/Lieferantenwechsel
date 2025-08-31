"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs-extra");
const os = require("os");

const { ensureDirs, atomicWrite, backupDir, cleanupTemps } = require("../src/utils/file-manager");

test("ensureDirs creates nested directories", async () => {
  const root = path.join(__dirname, "..", `tmp-fm-${Date.now()}`);
  const a = path.join(root, "a/b/c");
  const b = path.join(root, "x/y");
  await ensureDirs([a, b]);
  assert.equal(await fs.pathExists(a), true);
  assert.equal(await fs.pathExists(b), true);
});

test("atomicWrite writes string and json safely", async () => {
  const root = path.join(__dirname, "..", `tmp-fm-${Date.now()}-aw`);
  const f1 = path.join(root, "one.txt");
  const f2 = path.join(root, "two.json");
  await atomicWrite(f1, "hello");
  await atomicWrite(f2, { a: 1 });
  assert.equal(await fs.readFile(f1, "utf-8"), "hello");
  const json = await fs.readJson(f2);
  assert.equal(json.a, 1);
  // no .tmp residue
  const files = await fs.readdir(path.dirname(f1));
  assert.ok(files.every((n) => !n.includes(".tmp")));
});

test("backupDir copies directory to timestamped target", async () => {
  const root = path.join(__dirname, "..", `tmp-fm-${Date.now()}-bk`);
  const src = path.join(root, "src");
  const dest = path.join(root, "backups");
  await fs.ensureDir(src);
  await fs.writeFile(path.join(src, "a.txt"), "data");
  const target = await backupDir(src, dest);
  assert.ok(target.startsWith(dest));
  const copied = path.join(target, "a.txt");
  assert.equal(await fs.readFile(copied, "utf-8"), "data");
});

test("cleanupTemps removes .tmp files", async () => {
  const root = path.join(__dirname, "..", `tmp-fm-${Date.now()}-cl`);
  await fs.ensureDir(root);
  await fs.writeFile(path.join(root, "keep.txt"), "ok");
  await fs.writeFile(path.join(root, "x.tmp"), "tmp");
  await fs.writeFile(path.join(root, "y.tmp-123"), "tmp");
  const removed = await cleanupTemps(root);
  assert.equal(removed >= 1, true);
  const files = await fs.readdir(root);
  assert.ok(files.includes("keep.txt"));
  assert.ok(!files.some((n) => n.includes(".tmp")));
});
