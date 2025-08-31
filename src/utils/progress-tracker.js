const path = require('path');
const fs = require('fs-extra');

async function computeProgress({ stateDir, chapters }) {
  const stateFile = path.join(stateDir, 'current-generation.json');
  let st = null;
  try { st = await fs.readJson(stateFile); } catch {}
  const completedChapters = Array.isArray(st?.completedChapters) ? st.completedChapters.length : 0;
  const totalChapters = chapters?.length || 0;
  const percent = totalChapters ? Math.round((completedChapters / totalChapters) * 100) : 0;
  return { status: st?.status || 'n/a', phase: st?.currentPhase?.phase || 'n/a', completedChapters, totalChapters, percent };
}

function estimateETA({ startedAt, itemsDone, itemsTotal, avgMsPerItem = 60000 }) {
  if (!itemsTotal || itemsTotal <= 0) return null;
  const remaining = Math.max(itemsTotal - itemsDone, 0);
  const ms = remaining * avgMsPerItem;
  const eta = new Date(Date.now() + ms).toISOString();
  return { remaining, ms, eta };
}

module.exports = { computeProgress, estimateETA };
