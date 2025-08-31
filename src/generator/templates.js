function truncate(str, n = 200) {
  return (str || '').toString().slice(0, n).replace(/\s+/g, ' ').trim();
}

function renderSectionContent({ chapterId, sectionName, term, selectedItems }) {
  const lines = [];
  lines.push(`# ${chapterId} – ${sectionName}`);
  if (term) lines.push(`Suchbegriff: ${term}`);
  lines.push('');
  lines.push('Ausgewählte Quellen:');
  lines.push('');
  if (Array.isArray(selectedItems) && selectedItems.length) {
    for (const it of selectedItems) {
      const src = it?.payload?.source_document || 'n/a';
      const ct = it?.payload?.chunk_type || 'n/a';
      const preview = truncate(it?.payload?.content, 300);
      lines.push(`- [${ct}] ${src}: ${preview}`);
    }
  } else {
    lines.push('- (keine Auswahl – Platzhalterinhalt)');
  }
  lines.push('');
  lines.push('## Entwurf');
  lines.push('');
  lines.push('Dieser Abschnitt wurde automatisch aus den ausgewählten Ergebnissen skizziert.');
  return lines.join('\n');
}

module.exports = { renderSectionContent };
