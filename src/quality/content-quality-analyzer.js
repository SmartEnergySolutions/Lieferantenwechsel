"use strict";

const fs = require("fs-extra");
const path = require("path");
const { scoreSection } = require("./validator");

async function listMarkdownFiles(rootDir) {
  const out = [];
  if (!(await fs.pathExists(rootDir))) return out;
  const chapters = await fs.readdir(rootDir);
  for (const ch of chapters) {
    const chDir = path.join(rootDir, ch);
    const stats = await fs.stat(chDir).catch(() => null);
    if (!stats || !stats.isDirectory()) continue;
    const files = (await fs.readdir(chDir)).filter((f) => f.endsWith(".md"));
    for (const f of files) out.push({ chapterId: ch, file: path.join(chDir, f) });
  }
  return out;
}

async function analyzeOutputs({ outputsDir, minWords = 50, warnBelow = 0.7 }) {
  const files = await listMarkdownFiles(outputsDir);
  const details = [];
  for (const it of files) {
    try {
      const content = await fs.readFile(it.file, "utf-8");
      const res = scoreSection(content, { minWords });
      details.push({ chapterId: it.chapterId, file: it.file, ...res });
    } catch {}
  }
  const byChapter = new Map();
  for (const d of details) {
    const k = d.chapterId;
    if (!byChapter.has(k)) byChapter.set(k, []);
    byChapter.get(k).push(d);
  }
  const chapters = [];
  let lowQuality = 0;
  for (const [ch, items] of byChapter.entries()) {
    const avg = items.length ? Number((items.reduce((a, b) => a + b.score, 0) / items.length).toFixed(2)) : 0;
    const flagged = items.filter((i) => i.score < warnBelow).length;
    lowQuality += flagged;
    chapters.push({ chapterId: ch, files: items.length, avgScore: avg, flagged });
  }
  chapters.sort((a, b) => a.chapterId.localeCompare(b.chapterId));
  const avgAll = details.length ? Number((details.reduce((a, b) => a + b.score, 0) / details.length).toFixed(2)) : 0;
  return { files: details.length, chapters, average: avgAll, lowQuality, minWords, warnBelow };
}

module.exports = { analyzeOutputs };
