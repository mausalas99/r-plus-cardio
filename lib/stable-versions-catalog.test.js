const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  normalizeCatalog,
  upsertStableVersionEntry,
} = require('./stable-versions-catalog.js');

test('normalizeCatalog valida schema y ordena semver desc', () => {
  const cat = normalizeCatalog({
    schema: 1,
    entries: [{ version: '6.5.2' }, { version: '6.5.3' }],
  });
  assert.equal(cat.entries[0].version, '6.5.3');
});

test('upsertStableVersionEntry añade o actualiza sin duplicar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stable-cat-'));
  const file = path.join(dir, 'stable-versions.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ schema: 1, entries: [{ version: '6.5.3', summary: 'old' }] }),
    'utf8'
  );
  upsertStableVersionEntry(file, {
    version: '6.5.4',
    summary: 'Identidad LAN',
    recommended: true,
  });
  upsertStableVersionEntry(file, {
    version: '6.5.3',
    summary: 'Parche guardia',
  });
  const next = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(next.entries.length, 2);
  assert.equal(next.entries[0].version, '6.5.4');
  assert.equal(next.entries[0].recommended, true);
  assert.equal(next.entries[1].summary, 'Parche guardia');
  fs.rmSync(dir, { recursive: true, force: true });
});
