"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs-extra");
const path = require("path");

const { analyzeOutputs } = require("../src/quality/content-quality-analyzer");

test("analyzeOutputs summarizes chapters and flags low quality", async () => {
  const root = path.join(__dirname, "..", `tmp-outputs-${Date.now()}`);
  const ch = path.join(root, "01-overview");
  await fs.mkdirp(ch);
  await fs.writeFile(path.join(ch, "01-overview__short.md"), "# T\nkurz\n");
  await fs.writeFile(path.join(ch, "01-overview__okay.md"), "# Title\n\n" + "word ".repeat(60) + "\n\nAusgewählte Quellen:\n- A\n");

  const rep = await analyzeOutputs({ outputsDir: root, minWords: 50, warnBelow: 0.7 });
  assert.equal(rep.files, 2);
  assert.equal(rep.chapters.length, 1);
  assert.ok(rep.average > 0);
  assert.equal(rep.lowQuality >= 1, true);
});
