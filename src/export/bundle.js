"use strict";

const fs = require('fs-extra');
const path = require('path');

function toTitle(name) {
  const base = name.replace(/^[0-9]+[-_]?/, '').replace(/\.(md|markdown)$/i, '');
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function anchorFor(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function buildAnchors(files) {
  const map = new Map();
  for (const f of files) {
    const section = toTitle(f.file);
    const anchor = anchorFor(section);
    const base = f.file.replace(/\.(md|markdown)$/i, '');
    map.set(base.toLowerCase(), { section, anchor });
    // Key by chapter and slug
    const m = base.match(/^(.*)__([\w-]+)$/);
    if (m) {
      map.set(`${(m[1] || '').toLowerCase()}::${(m[2] || '').toLowerCase()}`, { section, anchor });
    }
    // Key by section title lowercased
    map.set(section.toLowerCase(), { section, anchor });
  }
  return map;
}

function resolveRefs(md, anchors) {
  return (md || '').replace(/\[\[ref:([^\]]+)\]\]/gi, (_, raw) => {
    const key = String(raw || '').trim().toLowerCase();
    const hit = anchors.get(key);
    if (hit) return `[${hit.section}](#${hit.anchor})`;
    return _; // leave untouched if not found
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
        if (/\.(md|markdown)$/i.test(f)) files.push({ chapter: chap, file: f, full: path.join(dir, f) });
      }
    } catch {}
  }
  files.sort((a, b) => (a.chapter.localeCompare(b.chapter) || a.file.localeCompare(b.file)));
  return files;
}

async function bundleMarkdown({ outputsDir, destFile, toFile, title = 'Lieferantenwechsel', includeTOC = true }) {
  const outFile = destFile || toFile;
  const parts = [];
  if (title) {
    parts.push(`# ${title}`);
    parts.push('');
  }
  const files = await listMarkdownFiles(outputsDir);
  const anchors = buildAnchors(files);
  if (includeTOC && files.length) {
    // Try to load a custom ToC template if present
    const tplPath = path.join(process.cwd(), 'templates', 'toc-template.md');
    let toc = null;
    try { toc = await fs.readFile(tplPath, 'utf-8'); } catch {}
    if (toc) {
      const items = files.map(f => {
        const section = toTitle(f.file);
        const anchor = anchorFor(section);
        return `- [${section}](#${anchor})`;
      }).join('\n');
      const rendered = toc
        .replace(/\{\{\s*title\s*\}\}/gi, title || 'Inhalt')
        .replace(/\{\{\s*list\s*\}\}/gi, items);
      parts.push(rendered.trim());
      parts.push('');
    } else {
      parts.push('## Inhalt');
      for (const f of files) {
        const section = toTitle(f.file);
        const anchor = anchorFor(section);
        parts.push(`- [${section}](#${anchor})`);
      }
      parts.push('');
    }
  }
  for (const f of files) {
  let raw = await fs.readFile(f.full, 'utf-8');
  raw = resolveRefs(raw, anchors);
    // ensure the first heading has a predictable anchor
    const section = toTitle(f.file);
    parts.push(`\n\n## ${section}\n`);
    parts.push(raw.trim());
  }
  // Append appendix templates if available
  try {
    const appDir = path.join(process.cwd(), 'templates', 'appendix-templates');
    const exists = await fs.pathExists(appDir);
    if (exists) {
      const appFiles = (await fs.readdir(appDir)).filter(f => /\.(md|markdown)$/i.test(f)).sort();
      if (appFiles.length) {
        parts.push('\n\n## Anhang');
        for (const af of appFiles) {
          const txt = await fs.readFile(path.join(appDir, af), 'utf-8');
          parts.push('\n');
          parts.push(txt.trim());
        }
      }
    }
  } catch {}
  const out = parts.join('\n');
  await fs.mkdirp(path.dirname(outFile));
  await fs.writeFile(outFile, out, 'utf-8');
  return { count: files.length, destFile: outFile };
}

module.exports = { bundleMarkdown, listMarkdownFiles };
