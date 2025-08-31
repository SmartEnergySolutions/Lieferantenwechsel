const path = require('path');
const fs = require('fs-extra');

class CheckpointManager {
  constructor(baseDir = path.resolve('state', 'checkpoints')) {
    this.baseDir = baseDir;
  }

  async list() {
    try {
      const files = (await fs.readdir(this.baseDir)).filter((f) => f.endsWith('.json'));
      files.sort();
      return files;
    } catch {
      return [];
    }
  }

  async get(idOrFile) {
    const file = idOrFile.endsWith('.json') ? idOrFile : `${idOrFile}.json`;
    const full = path.join(this.baseDir, file);
    const txt = await fs.readFile(full, 'utf-8');
    return JSON.parse(txt);
  }
}

module.exports = { CheckpointManager };
