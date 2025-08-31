"use strict";

const path = require("path");
const fs = require("fs-extra");
const cfg = require("../config/config");
const { StateManager } = require("../state/state-manager");

/**
 * runValidationEngine
 * Aggregates all validators (consistency, outputs, coverage, crossrefs) and writes a report under state/validation.
 * Options allow overriding directories (useful for tests) and enabling fixes.
 */
async function runValidationEngine(options = {}) {
  const {
    stateDir = cfg.state.dir,
    outputsDir = cfg.outputs.dir,
    fix = false,
    minSectionsPerChapter = 1,
  } = options;

  const sm = new StateManager(stateDir);
  const reportDir = path.join(stateDir, "validation");
  await fs.mkdirp(reportDir);

  // Load active chapters for coverage
  const { getActiveChapters } = require("../config/loader");
  let chapters = [];
  try { ({ chapters } = await getActiveChapters()); } catch { chapters = []; }

  const { validateConsistency } = require("../state/state-validator");
  const { validateOutputsAgainstState } = require("../state/outputs-validator");
  const { coverageReport } = require("../state/coverage-validator");
  const { validateCrossRefs } = require("../export/crossrefs");

  const consistency = await validateConsistency(stateDir, { fix });
  const outputs = await validateOutputsAgainstState({ stateDir, outputsDir, fix });
  const coverage = await coverageReport({ outputsDir, chapters, minSectionsPerChapter });
  const crossrefs = await validateCrossRefs({ outputsDir });

  const valid = !!(consistency.valid && outputs.valid && coverage.valid && crossrefs.valid);
  const summary = {
    at: new Date().toISOString(),
    valid,
    problems: [
      ...(consistency.valid ? [] : ["consistency"]),
      ...(outputs.valid ? [] : ["outputs"]),
      ...(coverage.valid ? [] : ["coverage"]),
      ...(crossrefs.valid ? [] : ["crossrefs"]),
    ],
  };

  const file = path.join(reportDir, "last-report.json");
  try {
    await fs.writeJson(file, { summary, consistency, outputs, coverage, crossrefs }, { spaces: 2 });
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      await fs.mkdirp(reportDir);
      await fs.writeJson(file, { summary, consistency, outputs, coverage, crossrefs }, { spaces: 2 });
    } else {
      throw e;
    }
  }

  // Minimal stateful touch: persist last validation in current-generation
  try {
    const s = (await sm.getCurrentState()) || { generationId: `gen_${Date.now()}`, status: "INITIALIZED", currentPhase: { phase: "VALIDATION", interruptible: true } };
    s.currentPhase = { phase: "VALIDATION", interruptible: true };
    s.lastValidation = summary;
    await sm.saveState(s);
  } catch {}

  return { valid, file, consistency, outputs, coverage, crossrefs, summary };
}

module.exports = { runValidationEngine };
