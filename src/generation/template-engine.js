"use strict";

const fs = require("fs-extra");
const path = require("path");

function render(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? ""));
}

async function loadTemplateForLevel(level) {
  const name = (level || "standard").toLowerCase();
  const map = {
    beginner: "beginner.md",
    standard: "intermediate.md",
    intermediate: "intermediate.md",
    advanced: "advanced.md",
    expert: "expert.md",
  };
  const file = path.join(process.cwd(), "templates", "chapter-templates", map[name] || map.standard);
  try { return await fs.readFile(file, "utf-8"); } catch {
    return "# {{title}}\n\n## {{sectionName}}\n\n{{content}}\n";
  }
}

async function renderSection({ chapter, sectionName, content }) {
  const tpl = await loadTemplateForLevel(chapter.level);
  return render(tpl, { title: chapter.title || chapter.id, chapterId: chapter.id, sectionName, content });
}

module.exports = { renderSection };
