"use strict";

const fs = require("fs-extra");
const path = require("path");

function mdToHtml(md) {
  // Very small conversion for headings and paragraphs
  return md
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^\s*\- (.*)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    .replace(/<p><h(\d)>/g, '<h$1>')
    .replace(/<\/h(\d)><\/p>/g, '</h$1>');
}

async function bundleHtml({ title = "Bundle", markdown, toFile }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${mdToHtml(markdown)}</body></html>`;
  if (toFile) {
    await fs.ensureDir(path.dirname(toFile));
    await fs.writeFile(toFile, html, "utf-8");
  }
  return html;
}

module.exports = { mdToHtml, bundleHtml };
const fs = require('fs-extra');
const path = require('path');

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mdToHtml(md) {
  // Minimal Markdown -> HTML (headings + paragraphs + lists)
  const lines = (md || '').split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (/^\s*#/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      const m = line.match(/^(#+)\s*(.*)$/);
      const level = Math.min(m[1].length, 6);
      out.push(`<h${level}>${escapeHtml(m[2])}</h${level}>`);
    } else if (/^\s*-\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${escapeHtml(line.replace(/^\s*-\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

async function bundleToHtml({ outputsDir, destFile, title = 'Lieferantenwechsel' }) {
  const { listMarkdownFiles } = require('./bundle');
  const files = await listMarkdownFiles(outputsDir);
  let combined = `# ${title}\n\n`;
  for (const f of files) {
    const md = await fs.readFile(f, 'utf-8');
    combined += md + '\n\n';
  }
  const body = mdToHtml(combined);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:900px;margin:24px auto;line-height:1.5}pre,code{font-family:ui-monospace,Menlo,monospace}h1,h2,h3{margin-top:1.5em}</style></head><body>${body}</body></html>`;
  await fs.mkdirp(path.dirname(destFile));
  await fs.writeFile(destFile, html, 'utf-8');
  return { files: files.length, destFile };
}

module.exports = { bundleToHtml };
