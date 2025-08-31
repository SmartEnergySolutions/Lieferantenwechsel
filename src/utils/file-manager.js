"use strict";

const fs = require("fs-extra");
const path = require("path");

async function ensureDirs(paths) {
  for (const p of paths) {
    await fs.ensureDir(p);
  }
}

async function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.ensureDir(dir);
  const tmp = `${filePath}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  await fs.move(tmp, filePath, { overwrite: true });
}

async function backupDir(srcDir, destDir) {
  await fs.ensureDir(destDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(destDir, `backup-${stamp}`);
  await fs.copy(srcDir, target);
  return target;
}

async function cleanupTemps(rootDir) {
  if (!(await fs.pathExists(rootDir))) return 0;
  const entries = await fs.readdir(rootDir);
  let removed = 0;
  for (const e of entries) {
    if (e.includes(".tmp")) {
      try {
        await fs.remove(path.join(rootDir, e));
        removed += 1;
      } catch {}
    }
  }
  return removed;
}

module.exports = {
  ensureDirs,
  atomicWrite,
  backupDir,
  cleanupTemps,
};


