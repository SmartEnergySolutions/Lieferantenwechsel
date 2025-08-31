"use strict";

const os = require("os");

function analyzeContent(markdown = "") {
  const lines = String(markdown).split(/\r?\n/);
  let h1s = 0;
  let emptyRuns = 0;
  let maxLineLen = 0;
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    maxLineLen = Math.max(maxLineLen, line.length);
    if (/^#(\s|$)/.test(line)) h1s++;
    if (line.trim() === "") emptyRuns++;
    else emptyRuns = 0;
    if (emptyRuns > 1) {
      issues.push({ type: "too_many_blank_lines", line: i + 1 });
    }
    if (/\s+$/.test(line)) {
      issues.push({ type: "trailing_whitespace", line: i + 1 });
    }
  }

  if (h1s > 1) {
    issues.push({ type: "multiple_h1_headings", count: h1s });
  }

  return {
    lines: lines.length,
    headings: { h1: h1s },
    maxLineLen,
    issues,
  };
}

function softWrap(line, max = 100) {
  if (line.length <= max) return [line];
  const out = [];
  let rest = line;
  while (rest.length > max) {
    // find last space within window
    const window = rest.slice(0, max + 1);
    const cut = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\t"));
    if (cut <= 0) break; // no space found, avoid infinite loop
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1);
  }
  if (rest) out.push(rest);
  return out;
}

function refineContent(markdown = "", opts = {}) {
  const options = {
    normalizeHeadings: true,
    trimWhitespace: true,
    maxLine: null,
    ...opts,
  };

  const changes = [];
  const lines = String(markdown).split(/\r?\n/);

  // normalize headings: only first H1 remains H1, convert subsequent H1 to H2
  if (options.normalizeHeadings) {
    let seenH1 = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^#(\s|$)/.test(lines[i])) {
        if (seenH1) {
          lines[i] = lines[i].replace(/^#(\s|$)/, "## ");
          changes.push(`Converted extra H1 to H2 at line ${i + 1}`);
        } else {
          seenH1 = true;
        }
      }
    }
  }

  // trim trailing whitespace and collapse excessive blank lines
  if (options.trimWhitespace) {
    let emptyRun = 0;
    for (let i = 0; i < lines.length; i++) {
      const before = lines[i];
      const trimmedEnd = before.replace(/\s+$/, "");
      if (trimmedEnd !== before) changes.push(`Trimmed trailing whitespace at line ${i + 1}`);
      lines[i] = trimmedEnd;
      if (lines[i].trim() === "") emptyRun++;
      else emptyRun = 0;
      if (emptyRun > 1) {
        lines.splice(i, 1);
        changes.push(`Removed extra blank line at ${i + 1}`);
        i--; // re-check current index
        emptyRun--;
      }
    }
  }

  // soft wrap long lines
  if (Number.isFinite(options.maxLine) && options.maxLine > 20) {
    const wrapped = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {
        // keep code blocks unchanged
        wrapped.push(l);
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { wrapped.push(lines[i]); i++; }
        if (i < lines.length) wrapped.push(lines[i]);
        continue;
      }
      if (l.length > options.maxLine && /\s/.test(l)) {
        const parts = softWrap(l, options.maxLine);
        if (parts.length > 1) changes.push(`Wrapped line ${i + 1} into ${parts.length} lines`);
        wrapped.push(...parts);
      } else {
        wrapped.push(l);
      }
    }
    while (lines.length) lines.pop();
    Array.prototype.push.apply(lines, wrapped);
  }

  // ensure single trailing newline
  const result = lines.join("\n").replace(/\s*$/, "") + os.EOL;

  return { content: result, changes };
}

module.exports = { analyzeContent, refineContent };
