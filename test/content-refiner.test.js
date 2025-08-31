"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { analyzeContent, refineContent } = require("../src/interactive/content-refiner");

test("analyzeContent finds multiple H1 and trailing whitespace", () => {
  const md = "# Title\n\n# Another\nLine with space   \n\n\nText\n";
  const rep = analyzeContent(md);
  assert.equal(rep.headings.h1, 2);
  const types = rep.issues.map((i) => i.type);
  assert(types.includes("multiple_h1_headings"));
  assert(types.includes("trailing_whitespace"));
});

test("refineContent normalizes extra H1 and trims whitespace", () => {
  const md = "# Title\n\n# Another\nLine with space   \n\n\nText\n";
  const { content, changes } = refineContent(md, { maxLine: 80 });
  assert(content.startsWith("# Title\n\n## Another\nLine with space\n\nText\n"));
  assert(changes.some((c) => c.includes("Converted extra H1")));
  assert(changes.some((c) => c.includes("Trimmed trailing whitespace")));
});
