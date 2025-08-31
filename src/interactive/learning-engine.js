"use strict";

const { analyzeFeedback } = require("./feedback-analyzer");

function uniqueMerge(arrA = [], arrB = []) {
  const set = new Set([...(arrA || []), ...(arrB || [])].map((s) => String(s)));
  return Array.from(set.values()).filter(Boolean);
}

// Map analyzer suggestions to state userPreferences shape
function derivePreferences(history = []) {
  const { suggestions } = analyzeFeedback(history);
  const searchStrategy = {
    alpha: suggestions?.search?.alpha ?? 0.7,
    priorityChunkTypes: suggestions?.search?.priorityChunkTypes || [],
    adaptiveKeywords: suggestions?.search?.adaptiveKeywords || [],
  };
  const contentPreferences = {
    exampleDensity: suggestions?.content?.exampleDensity || "medium",
    technicalDetail: suggestions?.content?.technicalDetail || "medium",
  };
  return { searchStrategy, contentPreferences };
}

async function applyLearning({ stateManager, history = [] }) {
  if (!stateManager || typeof stateManager.getCurrentState !== "function") {
    throw new Error("stateManager with getCurrentState/saveState required");
  }
  const prefs = derivePreferences(history);
  const state = (await stateManager.getCurrentState()) || (await stateManager.initializeState({}));
  state.userPreferences = state.userPreferences || {};
  const currentSearch = state.userPreferences.searchStrategy || {};
  const currentContent = state.userPreferences.contentPreferences || {};

  const merged = {
    searchStrategy: {
      alpha: Number.isFinite(currentSearch.alpha) ? (currentSearch.alpha * 0.5 + prefs.searchStrategy.alpha * 0.5) : prefs.searchStrategy.alpha,
      priorityChunkTypes: uniqueMerge(currentSearch.priorityChunkTypes, prefs.searchStrategy.priorityChunkTypes),
      adaptiveKeywords: uniqueMerge(currentSearch.adaptiveKeywords, prefs.searchStrategy.adaptiveKeywords),
    },
    contentPreferences: {
      exampleDensity: prefs.contentPreferences.exampleDensity,
      technicalDetail: prefs.contentPreferences.technicalDetail,
      crossReferenceStyle: currentContent.crossReferenceStyle || "inline",
    },
  };

  state.userPreferences = merged;
  await stateManager.saveState(state, false);
  return merged;
}

module.exports = { derivePreferences, applyLearning };
