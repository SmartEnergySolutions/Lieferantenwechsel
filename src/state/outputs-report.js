"use strict";

const fs = require("fs-extra");
const path = require("path");

async function listMarkdown(dir) {
  if (!(await fs.pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  return files.filter((f) => f.toLowerCase().endsWith(".md")).map((f) => path.join(dir, f));
}

async function outputsReport({ stateDir, outputsDir, chapters }) {
  const chaptersDir = path.join(stateDir, "chapter-states");
  const res = { chapters: [], totals: { files: 0, sections: 0, avgQuality: null } };
  let qualitySum = 0, qualityCount = 0;
  for (const ch of chapters) {
    const outDir = path.join(outputsDir, ch.id);
    const files = await listMarkdown(outDir);
    const chapterFile = path.join(chaptersDir, `${ch.id}.json`);
    let state = null;
    try { state = await fs.readJson(chapterFile); } catch {}
    const completedSections = Array.isArray(state?.completedSections) ? state.completedSections : [];
    const avgQuality = (() => {
      const q = completedSections.map((s) => s?.generatedContent?.qualityScore).filter((v) => typeof v === "number");
      if (!q.length) return null;
      return q.reduce((a, b) => a + b, 0) / q.length;
    })();
    if (typeof avgQuality === "number") { qualitySum += avgQuality; qualityCount += 1; }
    res.chapters.push({
      chapterId: ch.id,
      expectedSections: Array.isArray(ch.sections) ? ch.sections.length : 0,
      outputFiles: files.map((f) => path.basename(f)),
      outputsCount: files.length,
      completedSectionsCount: completedSections.length,
      avgQuality,
    });
    res.totals.files += files.length;
    res.totals.sections += completedSections.length;
  }
  res.totals.avgQuality = qualityCount ? qualitySum / qualityCount : null;
  return res;
}

module.exports = { outputsReport };
const fs = require('fs-extra');
const path = require('path');

async function listMarkdown(dir) {
  if (!(await fs.pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  return files.filter(f => f.toLowerCase().endsWith('.md')).map(f => path.join(dir, f));
}

async function outputsReport({ stateDir, outputsDir, chapters }) {
  const chaptersDir = path.join(stateDir, 'chapter-states');
  const res = { chapters: [], totals: { files: 0, sections: 0, avgQuality: null } };
  let qualitySum = 0, qualityCount = 0;
  for (const ch of chapters) {
    const outDir = path.join(outputsDir, ch.id);
    const files = await listMarkdown(outDir);
    const chapterFile = path.join(chaptersDir, `${ch.id}.json`);
    let state = null;
    try { state = await fs.readJson(chapterFile); } catch {}
    const completedSections = Array.isArray(state?.completedSections) ? state.completedSections : [];
    const avgQuality = (() => {
      const q = completedSections.map(s => s?.generatedContent?.qualityScore).filter(v => typeof v === 'number');
      if (!q.length) return null;
      return q.reduce((a,b)=>a+b,0) / q.length;
    })();
    if (typeof avgQuality === 'number') { qualitySum += avgQuality; qualityCount += 1; }
    res.chapters.push({
      chapterId: ch.id,
      expectedSections: Array.isArray(ch.sections) ? ch.sections.length : 0,
      outputFiles: files.map(f => path.basename(f)),
      outputsCount: files.length,
      completedSectionsCount: completedSections.length,
      avgQuality,
    });
    res.totals.files += files.length;
    res.totals.sections += completedSections.length;
  }
  res.totals.avgQuality = qualityCount ? (qualitySum / qualityCount) : null;
  return res;
}

module.exports = { outputsReport };
