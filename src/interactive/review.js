const readline = require('readline');

function printResults(results) {
  const items = Array.isArray(results?.points) ? results.points : results || [];
  items.forEach((r, idx) => {
    const src = r.payload?.source_document || 'n/a';
    const ct = r.payload?.chunk_type || 'n/a';
    const preview = (r.payload?.content || '').toString().slice(0, 100).replace(/\s+/g, ' ');
    console.log(`${idx}. [${ct}] ${src} :: ${preview}`);
  });
}

function parseSelectArg(selectArg, total) {
  if (!selectArg) return null;
  if (selectArg.startsWith('top:')) {
    const n = parseInt(selectArg.split(':')[1] || '3', 10);
  return Array.from({ length: Math.min(n, total) }, (_, i) => i);
  }
  return selectArg
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < total);
}

async function promptSelection(total) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((res) => rl.question(q, res));
  const answer = await question('Wähle Indizes (z.B. 0,2,3) oder Enter für keine Auswahl: ');
  rl.close();
  return parseSelectArg(answer || '', total) || [];
}

module.exports = { printResults, parseSelectArg, promptSelection };
