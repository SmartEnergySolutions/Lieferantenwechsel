"use strict";

function countOccurrences(text, regex) {
  const m = String(text).match(new RegExp(regex, "gi"));
  return m ? m.length : 0;
}

function evaluateQuality(markdown = "", opts = {}) {
  const text = String(markdown);
  const lines = text.split(/\r?\n/);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[\.\!\?]+\s+/).filter((s) => s.trim().length > 0);
  const headings = { h1: 0, h2: 0, h3: 0 };
  let codeBlocks = 0;
  let inCode = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) { inCode = !inCode; if (inCode) codeBlocks++; continue; }
    if (inCode) continue;
    if (/^#\s/.test(l)) headings.h1++;
    else if (/^##\s/.test(l)) headings.h2++;
    else if (/^###\s/.test(l)) headings.h3++;
  }

  const examples = countOccurrences(text, /(Beispiel|z\.B\.|Example)/);
  const technicalTerms = countOccurrences(text, /(EDI|UTILMD|ANMELD|ALOCAT|GPKE|MPES|QDRANT|JSON|API)/);
  const avgSentenceLen = sentences.length ? words.length / sentences.length : words.length || 0;

  // scoring
  const structureScore = (headings.h1 + headings.h2 + headings.h3) >= 2 ? 1 : (headings.h1 ? 0.7 : 0.4);
  const exampleScore = examples > 0 ? 1 : 0.6;
  const technicalScore = technicalTerms > 0 ? 1 : 0.7;
  let readabilityScore = 1;
  if (avgSentenceLen > 30) readabilityScore = 0.6; else if (avgSentenceLen < 6) readabilityScore = 0.7;
  const codeScore = codeBlocks >= 1 ? 1 : 0.8;

  const score = Number(
    0.25 * structureScore +
    0.2 * exampleScore +
    0.25 * technicalScore +
    0.2 * readabilityScore +
    0.1 * codeScore
  );

  const suggestions = [];
  if ((headings.h1 + headings.h2 + headings.h3) < 2) suggestions.push("Mehr Zwischenüberschriften für bessere Struktur hinzufügen.");
  if (examples === 0) suggestions.push("Beispiele (z.B., Beispiel:) ergänzen.");
  if (technicalTerms === 0) suggestions.push("Mehr fachliche Begriffe (z.B. UTILMD, ANMELD, ALOCAT) einstreuen.");
  if (avgSentenceLen > 30) suggestions.push("Sätze kürzen für bessere Lesbarkeit.");
  if (avgSentenceLen < 6 && sentences.length > 0) suggestions.push("Sätze zusammenführen oder detaillieren.");
  if (codeBlocks === 0) suggestions.push("Code- oder Datenbeispiele (z.B. JSON) einfügen.");

  return {
    score: Math.max(0, Math.min(1, Number(score.toFixed(2))))
    , metrics: { wordCount: words.length, sentenceCount: sentences.length, avgSentenceLen, headings, codeBlocks, examples, technicalTerms }
    , suggestions
  };
}

module.exports = { evaluateQuality };
