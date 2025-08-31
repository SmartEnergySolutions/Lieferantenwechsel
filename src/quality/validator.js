function countWords(str) {
  return (str || '').toString().trim().split(/\s+/).filter(Boolean).length;
}

function scoreSection(content, { minWords = 50 } = {}) {
  const words = countWords(content);
  const hasMinWords = words >= minWords;
  const hasHeading = /^#\s+/m.test(content);
  const hasSourcesList = /^Ausgewählte Quellen:/m.test(content);
  const checks = { words, hasMinWords, hasHeading, hasSourcesList };
  // simple weighted score
  const score = (
    (hasMinWords ? 0.5 : Math.min(words / Math.max(minWords, 1), 1) * 0.5) +
    (hasHeading ? 0.25 : 0) +
    (hasSourcesList ? 0.25 : 0)
  );
  return { score: Number(score.toFixed(2)), checks };
}

module.exports = { scoreSection };
