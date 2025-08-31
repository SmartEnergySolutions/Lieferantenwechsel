function normalizeText(t) {
  return (t || '').toString().toLowerCase();
}

function filterByChunkTypes(results, types = []) {
  if (!Array.isArray(types) || !types.length) return results || [];
  return (results || []).filter((r) => types.includes(r?.payload?.chunk_type));
}

function dedupeByIdOrSource(results) {
  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    const key = r?.id ?? `${r?.payload?.source_document}|${(r?.payload?.content || '').slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function scoreRelevance(result, { priorityChunkTypes = [], keywords = [] } = {}) {
  const ct = result?.payload?.chunk_type || '';
  const content = normalizeText(result?.payload?.content);
  let score = Number(result?.score ?? 0);
  // Boost for preferred chunk types
  if (priorityChunkTypes.includes(ct)) score += 0.2;
  // Boost for keyword matches
  for (const k of keywords || []) {
    if (!k) continue;
    if (content.includes(normalizeText(k))) score += 0.05;
  }
  return score;
}

function sortByRelevance(results, opts) {
  return [...(results || [])].sort((a, b) => scoreRelevance(b, opts) - scoreRelevance(a, opts));
}

function selectTop(results, n = 10) {
  return (results || []).slice(0, Math.max(0, n));
}

module.exports = {
  filterByChunkTypes,
  dedupeByIdOrSource,
  scoreRelevance,
  sortByRelevance,
  selectTop,
};
