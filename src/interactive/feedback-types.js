"use strict";

const FEEDBACK_TYPES = [
  "LIKE",
  "DISLIKE",
  "TOO_COMPLEX",
  "TOO_SIMPLE",
  "NEEDS_EXAMPLES",
  "NEEDS_TECH_DETAIL",
  "OFF_TOPIC",
  "AMBIGUOUS",
  "OTHER",
];

function isValidType(t) {
  const val = String(t || "").toUpperCase().trim();
  return FEEDBACK_TYPES.includes(val);
}

function normalizeType(t) {
  const val = String(t || "").toUpperCase().trim();
  return FEEDBACK_TYPES.includes(val) ? val : "OTHER";
}

module.exports = { FEEDBACK_TYPES, isValidType, normalizeType };
