"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { FEEDBACK_TYPES, isValidType, normalizeType } = require("../src/interactive/feedback-types");

test("FEEDBACK_TYPES contains expected categories", () => {
  const expected = ["LIKE","DISLIKE","TOO_COMPLEX","TOO_SIMPLE","NEEDS_EXAMPLES","NEEDS_TECH_DETAIL","OFF_TOPIC","AMBIGUOUS","OTHER"];
  for (const t of expected) assert.ok(FEEDBACK_TYPES.includes(t));
});

test("isValidType recognizes canonical and unknown types", () => {
  assert.equal(isValidType("like"), true);
  assert.equal(isValidType("unknown"), false);
});

test("normalizeType uppercases and maps unknown to OTHER", () => {
  assert.equal(normalizeType("dislike"), "DISLIKE");
  assert.equal(normalizeType("N/A"), "OTHER");
});
