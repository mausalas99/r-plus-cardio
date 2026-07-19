const fs = require('fs');
const { compareSemverCore, parseSemverCore } = require('./update-downgrade.js');

function normalizeCatalog(raw) {
  if (!raw || raw.schema !== 1 || !Array.isArray(raw.entries)) {
    throw new Error('stable-versions.json: schema inválido');
  }
  const entries = raw.entries
    .filter((e) => e && parseSemverCore(e.version))
    .map((e) => ({
      version: String(e.version).replace(/^v/, ''),
      label: String(e.label || e.version),
      publishedAt: e.publishedAt ? String(e.publishedAt) : undefined,
      summary: e.summary ? String(e.summary) : '',
      recommended: !!e.recommended,
    }))
    .sort((a, b) => compareSemverCore(b.version, a.version));
  return {
    schema: 1,
    updatedAt: raw.updatedAt || new Date().toISOString().slice(0, 10),
    entries,
  };
}

function upsertStableVersionEntry(catalogPath, entry) {
  const version = String(entry.version || '').replace(/^v/, '');
  if (!parseSemverCore(version)) throw new Error(`Versión inválida: ${entry.version}`);
  let raw = { schema: 1, entries: [] };
  if (fs.existsSync(catalogPath)) {
    raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  }
  const cat = normalizeCatalog(raw);
  const idx = cat.entries.findIndex((e) => e.version === version);
  const nextEntry = {
    version,
    label: String(entry.label || version),
    publishedAt: entry.publishedAt || new Date().toISOString().slice(0, 10),
    summary: String(entry.summary || ''),
    recommended: !!entry.recommended,
  };
  if (entry.recommended) {
    cat.entries.forEach((e) => {
      e.recommended = false;
    });
  }
  if (idx === -1) cat.entries.unshift(nextEntry);
  else cat.entries[idx] = { ...cat.entries[idx], ...nextEntry };
  cat.entries.sort((a, b) => compareSemverCore(b.version, a.version));
  cat.updatedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(catalogPath, JSON.stringify(cat, null, 2) + '\n', 'utf8');
  return cat;
}

module.exports = { normalizeCatalog, upsertStableVersionEntry };
