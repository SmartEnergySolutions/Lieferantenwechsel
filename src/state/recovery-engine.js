const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const cfg = require('../config/config');

async function smartRecover({ stateManager }) {
  const stateDir = cfg.state.dir;
  const currentFile = path.join(stateDir, 'current-generation.json');
  const { validateAllStates } = require('./state-validator');
  try {
    // 1) Try to validate and auto-fix
    const res = await validateAllStates(stateDir, { fix: true });
    if (res.valid) {
      logger.info('smart recover: state valid after fix');
      return { recovered: false, reason: 'STATE_VALID' };
    }
  } catch (e) {
    logger.warn('smart recover: validation failed', { error: e.message });
  }

  // 2) If invalid or validation failed, try latest checkpoint
  try {
    const latest = await stateManager.getLatestCheckpoint();
    if (latest?.checkpointId) {
      await stateManager.recoverFromCheckpoint(latest.checkpointId);
      logger.info('smart recover: restored from latest checkpoint', { checkpointId: latest.checkpointId });
      return { recovered: true, method: 'CHECKPOINT', checkpointId: latest.checkpointId };
    }
  } catch (e) {
    logger.warn('smart recover: checkpoint restore failed', { error: e.message });
  }

  // 3) If no checkpoint, re-initialize minimal state preserving dirs
  try {
    await fs.remove(currentFile);
  } catch {}
  const init = await stateManager.initializeState({});
  logger.info('smart recover: initialized fresh state', { generationId: init.generationId });
  return { recovered: true, method: 'FRESH_INIT', generationId: init.generationId };
}

module.exports = { smartRecover };
