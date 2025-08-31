"use strict";

// Build a Qdrant filter combining payload content and optional keywords.
function basicFilter(term) {
  const t = String(term || "");
  return {
    should: [
      { key: "content", match: { text: t } },
      { key: "keywords", match: { keyword: t.toLowerCase() } },
    ],
  };
}

// Merge two result lists by id with weighted scores and return sorted list.
function mergeWeighted(listA = [], listB = [], alpha = 0.7) {
  const a = Array.isArray(listA) ? listA : [];
  const b = Array.isArray(listB) ? listB : [];
  const byId = new Map();
  const getId = (p) => p?.id ?? p?.point?.id ?? p?.payload?.id ?? JSON.stringify(p?.payload || p || {});

  for (const p of a) {
    const id = getId(p);
    const score = Number(p?.score || 0) * (1 - alpha);
    byId.set(id, { p, score });
  }
  for (const p of b) {
    const id = getId(p);
    const inc = Number(p?.score || 0) * alpha;
    if (byId.has(id)) byId.get(id).score += inc;
    else byId.set(id, { p, score: inc });
  }

  return Array.from(byId.values())
    .map((x) => ({ ...x.p, score: x.score }))
    .sort((x, y) => (Number(y.score) || 0) - (Number(x.score) || 0));
}

module.exports = { basicFilter, mergeWeighted };
// Additional helpers
function chunkTypeFilter(types = []) {
  const list = Array.isArray(types) ? types.filter(Boolean) : [];
  if (!list.length) return null;
  return {
    should: list.map((t) => ({ key: "chunk_type", match: { keyword: String(t) } })),
  };
}

function combineFilters(...filters) {
  const out = { must: [], must_not: [], should: [] };
  for (const f of filters) {
    if (!f || typeof f !== "object") continue;
    if (Array.isArray(f.must)) out.must.push(...f.must);
    if (Array.isArray(f.must_not)) out.must_not.push(...f.must_not);
    if (Array.isArray(f.should)) out.should.push(...f.should);
  }
  // normalize empty arrays to undefined if no entries
  if (!out.must.length) delete out.must;
  if (!out.must_not.length) delete out.must_not;
  if (!out.should.length) delete out.should;
  return Object.keys(out).length ? out : null;
}

module.exports.chunkTypeFilter = chunkTypeFilter;
module.exports.combineFilters = combineFilters;
