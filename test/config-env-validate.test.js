const test = require('node:test');
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

test('env layered loading does not throw and validator reports sane result', async () => {
  // create temp dirs and files
  const tmp = path.join(__dirname, 'tmp-env');
  await fs.remove(tmp);
  await fs.mkdirp(tmp);
  const prevCwd = process.cwd();
  try {
    process.chdir(tmp);
    await fs.writeFile('.env', 'EMBEDDINGS_SIZE=256\n');
    await fs.writeFile('.env.local', 'OUTPUTS_DIR=./out\n');
    await fs.writeFile('.env.test', 'STATE_DIR=./st\n');
    process.env.NODE_ENV = 'test';
    delete require.cache[require.resolve('../src/config/config')];
    const cfg = require('../src/config/config');
    assert.equal(cfg.embeddings.size, 256);
    assert.ok(cfg.outputs.dir.endsWith(path.join('tmp-env','out')) || cfg.outputs.dir.endsWith('out'));
    assert.ok(cfg.state.dir.endsWith(path.join('tmp-env','st')) || cfg.state.dir.endsWith('st'));
    const { validateConfig } = require('../src/config/validator');
    const rep = await validateConfig();
    assert.equal(typeof rep.valid, 'boolean');
    assert.ok(Array.isArray(rep.issues));
  } finally {
    process.chdir(prevCwd);
  }
});
