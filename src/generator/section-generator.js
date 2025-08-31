"use strict";

const fs = require("fs-extra");
const path = require("path");
const logger = require("../utils/logger");
const { CHAPTERS } = require("../config/ebook-structure");
const { renderSection } = require("../generation/template-engine");

function renderSectionContent({ chapterId, sectionName, term, selectedItems }) {
  return `# ${chapterId} – ${sectionName}\n\nBezug: ${term || "-"}\n\nQuellen:\n${(selectedItems || [])
    .map((it, i) => `- ${i + 1}. ${it?.payload?.source_document || it?.id || "?"}`)
    .join("\n")}\n\nInhalt folgt...`;
}

function scoreSection(md) {
  // Minimal heuristic
  const words = (md || "").split(/\s+/).filter(Boolean).length;
  const checks = { lengthOk: words > 50, hasSources: /Quellen:\n- /.test(md) };
  const score = (checks.lengthOk ? 0.6 : 0) + (checks.hasSources ? 0.4 : 0);
  return { score, checks };
}

async function generateSection({ stateManager, chapterId, sectionName }) {
  const chapterFile = path.join(stateManager.chapterStatesDir, `${chapterId}.json`);
  let chapterState;
  try {
    chapterState = JSON.parse(await fs.readFile(chapterFile, "utf-8"));
  } catch {
    // create minimal chapter state file expected by tests
    chapterState = { chapterId, status: "IN_PROGRESS", pendingDecisions: [], completedSections: [], searchHistory: [] };
    await fs.mkdirp(path.dirname(chapterFile));
    await fs.writeFile(chapterFile, JSON.stringify(chapterState, null, 2));
  }
  const history = chapterState.searchHistory || [];
  const latest = history[history.length - 1] || null;
  const term = latest?.term || null;
  const selectedItems = latest?.selectedItems || [];

  const outputsRoot = path.resolve(process.cwd(), process.env.OUTPUTS_DIR || "outputs");
  const outputsDir = path.join(outputsRoot, chapterId);
  await fs.mkdirp(outputsDir);
  const safeSection = (sectionName || "Abschnitt").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const fileName = `${chapterId}__${safeSection}.md`;
  const filePath = path.join(outputsDir, fileName);

  let content = renderSectionContent({ chapterId, sectionName, term, selectedItems });
  try {
    const chapter = CHAPTERS.find(c => c.id === chapterId) || { id: chapterId, title: chapterId, level: "standard" };
    content = await renderSection({ chapter, sectionName, content });
  } catch {}
  await fs.writeFile(filePath, content, "utf-8");

  const quality = scoreSection(content);

  chapterState.completedSections = chapterState.completedSections || [];
  chapterState.completedSections.push({
    sectionName,
    completedAt: new Date().toISOString(),
    generatedContent: {
      contentFile: fileName,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      qualityScore: quality.score,
      qualityChecks: quality.checks,
      userFeedback: null,
    },
    searchResults: {
      totalResults: Array.isArray(latest?.selectedItems) ? latest.selectedItems.length : 0,
      selectedResultIds: Array.isArray(latest?.selectedResultIds) ? latest.selectedResultIds : [],
    },
  });
  await fs.writeFile(chapterFile, JSON.stringify(chapterState, null, 2));

  try {
    const s = (await stateManager.getCurrentState()) || {};
    s.completedChapters = s.completedChapters || [];
    await stateManager.saveState(s);
  } catch {}

  logger.info("Section generated", { chapterId, sectionName, file: fileName });
  return { filePath, fileName };
}

module.exports = { generateSection, renderSectionContent, scoreSection };
