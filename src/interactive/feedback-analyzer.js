"use strict";

// Analyze feedback history and propose adjustments to search/generation
// history item shape: { type, feedback, context, timestamp }
function analyzeFeedback(history = []) {
  const list = Array.isArray(history) ? history : [];
  const counts = {};
  const keywords = new Map();
  const preferredChunkTypes = new Map();
  let requestsMoreExamples = 0;
  let requestsMoreTechnical = 0;

  for (const it of list) {
    const type = (it?.type || "").toString();
    counts[type] = (counts[type] || 0) + 1;
    const fb = (it?.feedback || "").toString().toLowerCase();
    const ctxTerm = (it?.context?.term || "").toString().trim();
    if (ctxTerm) keywords.set(ctxTerm, (keywords.get(ctxTerm) || 0) + 1);

    if (fb.includes("beispiel") || fb.includes("beispiele")) requestsMoreExamples++;
    if (fb.includes("technisch") || fb.includes("details")) requestsMoreTechnical++;

    const chunkType = it?.context?.chunk_type || it?.context?.chunkType;
    if (chunkType) preferredChunkTypes.set(chunkType, (preferredChunkTypes.get(chunkType) || 0) + 1);
  }

  const topKeywords = Array.from(keywords.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  const topChunkTypes = Array.from(preferredChunkTypes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

  const suggestions = {
    search: {
      priorityChunkTypes: topChunkTypes.length ? topChunkTypes : ["pseudocode_flow", "pseudocode_validations_rules"],
      adaptiveKeywords: topKeywords,
      alpha: requestsMoreTechnical > requestsMoreExamples ? 0.8 : 0.7,
    },
    content: {
      exampleDensity: requestsMoreExamples > 0 ? "high" : "medium",
      technicalDetail: requestsMoreTechnical > 0 ? "high" : "medium",
    },
  };

  return {
    total: list.length,
    counts,
    suggestions,
  };
}

module.exports = { analyzeFeedback };
