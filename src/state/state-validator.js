"use strict";
const fs = require('fs-extra');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const logger = require('../utils/logger');
const { currentStateSchema, chapterStateSchema } = require('./state-schemas');

function buildAjv() {
  const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(currentStateSchema);
  ajv.addSchema(chapterStateSchema);
  return ajv;
}

async function validateCurrentState(stateFile, { fix = false } = {}) {
  const ajv = buildAjv();
  const validate = ajv.getSchema(currentStateSchema.$id) || ajv.compile(currentStateSchema);
  const problems = [];
  const exists = await fs.pathExists(stateFile);
  if (!exists) return { valid: false, problems: [`state file missing: ${stateFile}`] };
  let json;
  try { json = await fs.readJson(stateFile); } catch (e) {
    return { valid: false, problems: [`state not valid JSON: ${e.message}`] };
  }
  const ok = validate(json);
  if (!ok) {
    for (const err of validate.errors || []) problems.push(`${err.instancePath || '/'} ${err.message}`.trim());
  }
  if (!ok && fix) {
    // Minimal repair: inject defaults where obviously missing
    json.userPreferences = json.userPreferences || { searchStrategy: { alpha: 0.75 }, contentPreferences: {} };
    json.userPreferences.searchStrategy.alpha = typeof json.userPreferences.searchStrategy.alpha === 'number' ? json.userPreferences.searchStrategy.alpha : 0.75;
    json.completedChapters = Array.isArray(json.completedChapters) ? json.completedChapters : [];
    json.globalSettings = json.globalSettings || { autoSaveInterval: 30000 };
    if (typeof json.globalSettings.autoSaveInterval !== 'number') json.globalSettings.autoSaveInterval = 30000;
    // Re-validate
    const ok2 = validate(json);
    if (!ok2) {
      const errs = (validate.errors || []).map(e => `${e.instancePath || '/'} ${e.message}`.trim());
      return { valid: false, problems: errs };
    }
    // Save repaired
    await fs.writeJson(stateFile, json, { spaces: 2 });
    return { valid: true, problems: [], fixed: true };
  }
  return { valid: problems.length === 0, problems };
}

async function cleanupOldStates(stateDir, retentionDays = 7) {
  const cutoff = Date.now() - retentionDays * 86400000;
  let removed = 0;
  try {
    const files = await fs.readdir(stateDir);
    for (const f of files) {
      const full = path.join(stateDir, f);
      try {
        const stat = await fs.stat(full);
        if (stat.isFile() && stat.mtimeMs < cutoff && f.endsWith('.json')) {
          await fs.remove(full);
          removed++;
        }
      } catch {}
    }
  } catch {}
  logger.info('state cleanup', { removed, retentionDays });
  return removed;
}
async function validateChapterStates(chapterStatesDir, { fix = false } = {}) {
  const ajv = buildAjv();
  const validate = ajv.getSchema('https://schemas.lieferantenwechsel/chapter-state.json') || ajv.compile(require('./state-schemas').chapterStateSchema);
  const fs = require('fs-extra');
  const path = require('path');
  const results = [];
  try {
    const files = (await fs.pathExists(chapterStatesDir)) ? (await fs.readdir(chapterStatesDir)).filter(f => f.endsWith('.json')) : [];
    for (const f of files) {
      const full = path.join(chapterStatesDir, f);
      let json;
      let problems = [];
      let fixed = false;
      try { json = await fs.readJson(full); } catch (e) {
        results.push({ file: f, valid: false, problems: [`invalid JSON: ${e.message}`] });
        continue;
      }
      const ok = validate(json);
      if (!ok) problems = (validate.errors || []).map(e => `${e.instancePath || '/'} ${e.message}`.trim());
      if (!ok && fix) {
        // minimal repair
        json.chapterId = json.chapterId || f.replace(/\.json$/, '');
        json.status = json.status || 'IN_PROGRESS';
        if (json.currentSection && typeof json.currentSection !== 'object') json.currentSection = {};
        json.completedSections = Array.isArray(json.completedSections) ? json.completedSections : [];
        json.pendingDecisions = Array.isArray(json.pendingDecisions) ? json.pendingDecisions : [];
        json.completedDecisions = Array.isArray(json.completedDecisions) ? json.completedDecisions : [];
        const ok2 = validate(json);
        if (ok2) {
          await fs.writeJson(full, json, { spaces: 2 });
          fixed = true;
          problems = [];
        } else {
          problems = (validate.errors || []).map(e => `${e.instancePath || '/'} ${e.message}`.trim());
        }
      }
      results.push({ file: f, valid: problems.length === 0, problems, fixed });
    }
  } catch (e) {
    return { valid: false, error: e.message, files: [] };
  }
  const allValid = results.every(r => r.valid);
  return { valid: allValid, files: results };
}
async function validateAllStates(baseStateDir, { fix = false } = {}) {
  // Validate current-generation.json and all chapter-states together
  const stateFile = path.join(baseStateDir, 'current-generation.json');
  const chaptersDir = path.join(baseStateDir, 'chapter-states');
  const current = await validateCurrentState(stateFile, { fix });
  const chapters = await validateChapterStates(chaptersDir, { fix });
  const valid = !!(current.valid && chapters.valid);
  return { valid, current, chapters };
}
async function validateConsistency(baseStateDir, { fix = false } = {}) {
  const problems = [];
  const details = {
    missingChapterStates: [],
    completedMismatch: [],
    completedWithPendingDecisions: [],
    duplicateDecisionIds: [],
    invalidCurrentPhaseChapter: null,
    orphanCompletedChapters: [],
    filenameIdMismatch: [],
    fixed: {
      removedFromCompleted: [],
      clearedPendingOnCompleted: [],
      removedInvalidCurrentPhaseChapter: false,
      addedToCompleted: [],
      filesWritten: [],
    }
  };
  const stateFile = path.join(baseStateDir, 'current-generation.json');
  const chaptersDir = path.join(baseStateDir, 'chapter-states');
  const exists = await fs.pathExists(stateFile);
  if (!exists) {
    problems.push(`missing state file: ${stateFile}`);
    return { valid: false, problems, details };
  }
  let current;
  try { current = await fs.readJson(stateFile); } catch (e) {
    problems.push(`invalid state JSON: ${e.message}`);
    return { valid: false, problems, details };
  }
  const completedChapters = Array.isArray(current.completedChapters) ? [...current.completedChapters] : [];
  const chapterFiles = (await fs.pathExists(chaptersDir)) ? (await fs.readdir(chaptersDir)).filter(f=>f.endsWith('.json')) : [];
  const chapters = {};
  const presentIdsByFile = new Set(chapterFiles.map(f => f.replace(/\.json$/, '')));
  for (const f of chapterFiles) {
    try {
      const j = await fs.readJson(path.join(chaptersDir, f));
      const idFromFile = f.replace(/\.json$/, '');
      if (j && j.chapterId) {
        chapters[j.chapterId] = j;
        if (j.chapterId !== idFromFile) {
          details.filenameIdMismatch.push({ file: f, chapterId: j.chapterId, expected: idFromFile });
        }
      } else if (j) {
        chapters[idFromFile] = j;
      }
    } catch {}
  }
  // 1) For each completed chapter in current state, ensure chapter-state exists and is COMPLETED
  for (const cid of completedChapters) {
    const cs = chapters[cid];
    const existsByFile = presentIdsByFile.has(cid);
    if (!cs && !existsByFile) {
      details.missingChapterStates.push(cid);
      problems.push(`completed chapter missing state file: ${cid}`);
      if (fix) {
        const idx = current.completedChapters.indexOf(cid);
        if (idx >= 0) { current.completedChapters.splice(idx, 1); details.fixed.removedFromCompleted.push({ chapterId: cid, reason: 'missing chapter-state' }); }
      }
    } else if (cs.status !== 'COMPLETED') {
      details.completedMismatch.push({ chapterId: cid, status: cs.status });
      problems.push(`chapter ${cid} listed as completed but state.status=${cs.status}`);
      if (fix) {
        const idx = current.completedChapters.indexOf(cid);
        if (idx >= 0) { current.completedChapters.splice(idx, 1); details.fixed.removedFromCompleted.push({ chapterId: cid, reason: `status=${cs.status}` }); }
      }
    }
  }
  // 2) Completed chapters must not have pending decisions
  for (const cid of Object.keys(chapters)) {
    const cs = chapters[cid];
    if (cs.status === 'COMPLETED' && Array.isArray(cs.pendingDecisions) && cs.pendingDecisions.length > 0) {
      details.completedWithPendingDecisions.push({ chapterId: cid, count: cs.pendingDecisions.length });
      problems.push(`chapter ${cid} is COMPLETED but has ${cs.pendingDecisions.length} pendingDecisions`);
      if (fix) {
        try {
          cs.pendingDecisions = [];
          await fs.writeJson(path.join(chaptersDir, `${cid}.json`), cs, { spaces: 2 });
          details.fixed.clearedPendingOnCompleted.push(cid);
          details.fixed.filesWritten.push(path.join(chaptersDir, `${cid}.json`));
        } catch {}
      }
    }
  }
  // 2b) Orphan completed chapters: chapter-state COMPLETED but not listed in current.completedChapters
  for (const cid of Object.keys(chapters)) {
    const cs = chapters[cid];
    if (cs.status === 'COMPLETED' && !completedChapters.includes(cid)) {
      details.orphanCompletedChapters.push(cid);
      problems.push(`chapter ${cid} state is COMPLETED but not recorded in current.completedChapters`);
      if (fix) {
        try {
          current.completedChapters = Array.isArray(current.completedChapters) ? current.completedChapters : [];
          current.completedChapters.push(cid);
          details.fixed.addedToCompleted.push(cid);
        } catch {}
      }
    }
  }
  // 3) Duplicate decision IDs across chapters (pending+completed)
  const seen = new Map();
  for (const cid of Object.keys(chapters)) {
    const cs = chapters[cid];
    const pend = Array.isArray(cs.pendingDecisions) ? cs.pendingDecisions : [];
    const done = Array.isArray(cs.completedDecisions) ? cs.completedDecisions : [];
    for (const d of [...pend, ...done]) {
      const id = d && d.decisionId;
      if (!id) continue;
      const loc = `${cid}`;
      if (seen.has(id)) {
        details.duplicateDecisionIds.push({ decisionId: id, chapters: [seen.get(id), loc] });
        problems.push(`duplicate decisionId '${id}' across chapters ${seen.get(id)} and ${loc}`);
      } else {
        seen.set(id, loc);
      }
    }
  }
  // 4) If currentPhase.chapterId set, ensure chapter-state exists
  const curChap = current?.currentPhase?.chapterId;
  if (curChap) {
    if (!chapters[curChap]) {
      details.invalidCurrentPhaseChapter = { chapterId: curChap, reason: 'missing chapter-state' };
      problems.push(`currentPhase references chapter '${curChap}' which has no chapter-state`);
      if (fix) {
        try {
          if (current.currentPhase && 'chapterId' in current.currentPhase) {
            delete current.currentPhase.chapterId;
            details.fixed.removedInvalidCurrentPhaseChapter = true;
          }
        } catch {}
      }
    }
  }
  // Persist current state if fix changed it
  if (fix) {
    try {
      await fs.writeJson(stateFile, current, { spaces: 2 });
      details.fixed.filesWritten.push(stateFile);
    } catch {}
  }
  return { valid: problems.length === 0, problems, details };
}

module.exports = { validateCurrentState, validateChapterStates, validateAllStates, validateConsistency, cleanupOldStates, buildAjv };
