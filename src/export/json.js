"use strict";

const fs = require("fs-extra");
const path = require("path");

async function bundleJson({ title = "Lieferantenwechsel", chapters = [], outputsDir, toFile }) {
  const manifest = { title, generatedAt: new Date().toISOString(), chapters: [] };
  for (const ch of chapters) {
    const dir = path.join(outputsDir, ch.id);
    const files = (await fs.pathExists(dir)) ? (await fs.readdir(dir)).filter((f) => f.endsWith(".md")) : [];
    manifest.chapters.push({ id: ch.id, title: ch.title || ch.id, files: files.map((f) => ({ file: f, path: path.join(dir, f) })), sectionsCount: files.length });
  }
  if (toFile) {
    await fs.ensureDir(path.dirname(toFile));
    await fs.writeJson(toFile, manifest, { spaces: 2 });
  }
  return manifest;
}

module.exports = { bundleJson };
