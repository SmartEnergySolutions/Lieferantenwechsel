"use strict";

const fs = require('fs-extra');
const path = require('path');

function toTitle(name) {
  const base = String(name || '').replace(/^[0-9]+[-_]?/, '').replace(/\.(md|markdown)$/i, '');
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function anchorFor(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function buildAnchors(files) {
  const map = new Map();
  for (const f of files) {
    const section = toTitle(f.file);
    const anchor = anchorFor(section);
    const base = f.file.replace(/\.(md|markdown)$/i, '');
    map.set(base.toLowerCase(), { section, anchor });
    const m = base.match(/^(.*)__([\w-]+)$/);
    if (m) {
      map.set(`${(m[1] || '').toLowerCase()}::${(m[2] || '').toLowerCase()}`, { section, anchor });
    }
    map.set(section.toLowerCase(), { section, anchor });
  }
  return map;
}

let cachedTemplate = undefined;
async function getCrossRefTemplate() {
  if (cachedTemplate !== undefined) return cachedTemplate;
  const tplPath = path.join(process.cwd(), 'templates', 'crossref-template.md');
  try {
    const tpl = await fs.readFile(tplPath, 'utf-8');
    cachedTemplate = String(tpl);
  } catch {
    cachedTemplate = null;
  }
  return cachedTemplate;
}

function renderCrossRef(section, anchor, template) {
  if (!template) return `[${section}](#${anchor})`;
  return template
    .replace(/\{\{\s*section\s*\}\}/gi, section)
    .replace(/\{\{\s*anchor\s*\}\}/gi, anchor);
}

async function resolveRefs(md, anchors) {
  const tpl = await getCrossRefTemplate();
  return String(md || '').replace(/\[\[ref:([^\]]+)\]\]/gi, (whole, raw) => {
    const key = String(raw || '').trim().toLowerCase();
    const hit = anchors.get(key);
    if (hit) return renderCrossRef(hit.section, hit.anchor, tpl);
    return whole; // leave untouched if not found
  });
}

async function listMarkdownFiles(outputsDir) {
  const chapters = (await fs.pathExists(outputsDir)) ? await fs.readdir(outputsDir) : [];
  const files = [];
  for (const chap of chapters) {
    const dir = path.join(outputsDir, chap);
    try {
      const st = await fs.stat(dir);
      if (!st.isDirectory()) continue;
      const entries = await fs.readdir(dir);
      for (const f of entries) {
        if (/(\.|\/)\.(?!.)/.test(f)) continue; // skip dotfiles
        if (/\.(md|markdown)$/i.test(f)) files.push({ chapter: chap, file: f, full: path.join(dir, f) });
      }
    } catch {}
  }
  files.sort((a, b) => (a.chapter.localeCompare(b.chapter) || a.file.localeCompare(b.file)));
  return files;
}

async function validateCrossRefs({ outputsDir }) {
  const files = await listMarkdownFiles(outputsDir);
  const anchors = buildAnchors(files);
  const unresolved = [];
  let totalRefs = 0;
  for (const f of files) {
    const txt = await fs.readFile(f.full, 'utf-8');
    const matches = String(txt).match(/\[\[ref:([^\]]+)\]\]/gi) || [];
    for (const m of matches) {
      totalRefs++;
      const key = m.replace(/^[^:]*:/, '').replace(/\]\]$/, '').trim().toLowerCase();
      if (!anchors.get(key)) {
        unresolved.push({ file: f.file, ref: key });
      }
    }
  }
  return { valid: unresolved.length === 0, unresolved, totalRefs };
}

module.exports = {
  toTitle,
  anchorFor,
  buildAnchors,
  resolveRefs,
  validateCrossRefs,
  getCrossRefTemplate,
  renderCrossRef,
  listMarkdownFiles,
};
