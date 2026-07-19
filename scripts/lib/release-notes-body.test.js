/**
 * Release notes must be curated before publish (no stale default copy).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const { readPackageVersion } = require('./release-notes-body');

test('RELEASE_NOTES_6.6.8 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_6.6.8.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_6.6.8.txt still has TODO');
});

test('RELEASE_NOTES_6.6.9 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_6.6.9.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_6.6.9.txt still has TODO');
});

test('RELEASE_NOTES_6.7.0 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_6.7.0.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_6.7.0.txt still has TODO');
});

test('RELEASE_NOTES_7.0.1 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.0.1.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.0.1.txt still has TODO');
});

test('RELEASE_NOTES_7.0.2 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.0.2.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.0.2.txt still has TODO');
});

test('RELEASE_NOTES_7.0.3 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.0.3.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.0.3.txt still has TODO');
});

test('RELEASE_NOTES_7.1.0 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.0.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.0.txt still has TODO');
});

test('RELEASE_NOTES_7.1.1 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.1.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.1.txt still has TODO');
});

test('RELEASE_NOTES_7.1.2 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.2.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.2.txt still has TODO');
});

test('RELEASE_NOTES_7.1.3 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.3.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.3.txt still has TODO');
});

test('RELEASE_NOTES_7.1.8 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.8.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.8.txt still has TODO');
});

test('RELEASE_NOTES_7.1.9 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.9.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.9.txt still has TODO');
});

test('RELEASE_NOTES_7.1.10 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.1.10.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.1.10.txt still has TODO');
});

test('RELEASE_NOTES_7.2.0 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.0.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.0.txt still has TODO');
});

test('curated 7.2.0 highlights remain filled (not legacy empty)', async () => {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS['7.2.0'];
  assert.ok(Array.isArray(highlights) && highlights.length >= 3);
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!/title: 'TODO'/.test(joined));
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.ok(
    joined.includes('código') ||
      joined.includes('mDNS') ||
      joined.includes('huella')
  );
});

test('RELEASE_NOTES_7.2.4 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.4.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.4.txt still has TODO');
});

test('RELEASE_NOTES_7.2.5 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.5.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.5.txt still has TODO');
});

test('RELEASE_NOTES_7.2.6 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.6.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.6.txt still has TODO');
});

test('current package version RELEASE_NOTES has no TODO placeholders', () => {
  const version = readPackageVersion();
  const file = path.join(ROOT, 'docs', `RELEASE_NOTES_${version}.txt`);
  assert.ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`);
  const notes = fs.readFileSync(file, 'utf8');
  assert.ok(!/\bTODO\b/i.test(notes), `docs/RELEASE_NOTES_${version}.txt still has TODO`);
});

test('curated highlights for package.json version are current default', async () => {
  const version = readPackageVersion();
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS[version];
  assert.ok(
    Array.isArray(highlights) && highlights.length >= 2,
    `missing curated highlights for package.json version ${version}`
  );
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!/title: 'TODO'/.test(joined));
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.equal(
    mod.RELEASE_NOTES_HIGHLIGHTS_DEFAULT,
    highlights,
    `RELEASE_NOTES_HIGHLIGHTS_DEFAULT must match RELEASE_NOTES_HIGHLIGHTS['${version}']`
  );
});

test('RELEASE_NOTES_7.2.3 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.3.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.3.txt still has TODO');
});

test('curated 7.2.3 highlights are current default', async () => {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS['7.2.3'];
  assert.ok(Array.isArray(highlights) && highlights.length >= 3);
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!/title: 'TODO'/.test(joined));
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.ok(
    joined.includes('10.0.57.52') ||
      joined.includes('empaquetado') ||
      joined.includes('PIN')
  );
});

test('RELEASE_NOTES_7.2.2 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.2.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.2.txt still has TODO');
});

test('curated 7.2.2 highlights remain filled', async () => {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS['7.2.2'];
  assert.ok(Array.isArray(highlights) && highlights.length >= 3);
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!/title: 'TODO'/.test(joined));
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.ok(
    joined.includes('invitado') ||
      joined.includes('dirección') ||
      joined.includes('Reconexión')
  );
});

test('RELEASE_NOTES_7.2.1 has no TODO placeholders', () => {
  const notes = fs.readFileSync(
    path.join(ROOT, 'docs/RELEASE_NOTES_7.2.1.txt'),
    'utf8'
  );
  assert.ok(!/\bTODO\b/i.test(notes), 'docs/RELEASE_NOTES_7.2.1.txt still has TODO');
});

test('curated 7.2.1 highlights remain filled', async () => {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS['7.2.1'];
  assert.ok(Array.isArray(highlights) && highlights.length >= 3);
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!/title: 'TODO'/.test(joined));
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.ok(
    joined.includes('VLAN') ||
      joined.includes('PIN') ||
      joined.includes('anfitrión')
  );
});

test('curated 7.1.3 highlights remain filled (not legacy empty)', async () => {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS['7.1.3'];
  assert.ok(Array.isArray(highlights) && highlights.length >= 3);
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!/title: 'TODO'/.test(joined));
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.ok(joined.includes('signos') || joined.includes('Learn') || joined.includes('Interconsulta'));
});

test('curated 6.6.3 highlights remain filled (not legacy empty)', async () => {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const highlights = mod.RELEASE_NOTES_HIGHLIGHTS['6.6.3'];
  assert.ok(Array.isArray(highlights) && highlights.length >= 4);
  const joined = highlights.map((n) => `${n.title} ${n.body}`).join(' ');
  assert.ok(!joined.includes('Completar antes de publicar'));
  assert.ok(joined.includes('Arranque') || joined.includes('Windows'));
});
