/**
 * Evita omitir módulos que server.js (y lan-squad) cargan al arrancar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  PACK_FILES_BASELINE,
  NATIVE_MODULE_PACK_PATTERNS,
  ASAR_UNPACK_BASELINE,
  filePatternCovers,
  canonicalBuildFiles,
  canonicalAsarUnpack,
  assertRuntimeCoveredByPatterns,
  assertNativeModulesPacked,
  ensureElectronPackFiles,
} = require('./electron-pack-files');

const ROOT = path.join(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('lista canónica incluye lan-squad y lib/**/*.js / lib/**/*.cjs', () => {
  assert.ok(PACK_FILES_BASELINE.includes('lan-squad/**/*'));
  assert.ok(PACK_FILES_BASELINE.includes('lib/**/*.js'));
  assert.ok(PACK_FILES_BASELINE.includes('lib/**/*.cjs'));
});

test('server.js y dependencias LAN están cubiertos por la lista canónica', () => {
  assertRuntimeCoveredByPatterns(ROOT);
});

test('package.json build.files coincide con la lista canónica (mismos patrones)', () => {
  const canonical = canonicalBuildFiles(ROOT);
  assert.deepEqual([...pkg.build.files].sort(), [...canonical].sort());
});

test('package.json build.asarUnpack coincide con la lista canónica', () => {
  const canonical = canonicalAsarUnpack();
  assert.deepEqual([...pkg.build.asarUnpack].sort(), [...canonical].sort());
});

test('módulos nativos SQLCipher están en files y asarUnpack', () => {
  assertNativeModulesPacked(ROOT);
  for (const pattern of NATIVE_MODULE_PACK_PATTERNS) {
    assert.ok(ASAR_UNPACK_BASELINE.includes(pattern));
    assert.ok(canonicalBuildFiles(ROOT).includes(pattern));
  }
});

test('ensureElectronPackFiles sin --write no modifica si ya está sincronizado', () => {
  const before = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const result = ensureElectronPackFiles(ROOT, { write: false });
  assert.equal(result.changed, false);
  assert.equal(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'), before);
});

test('server.js require("./…") directo está en build.files', () => {
  const patterns = pkg.build.files || [];
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const relRequires = [...serverSrc.matchAll(/require\('\.\/([^']+)'\)/g)].map((m) => m[1]);
  for (const rel of relRequires) {
    assert.ok(
      filePatternCovers(rel, patterns),
      `Falta "${rel}" en package.json → build.files (server.js lo requiere al iniciar)`
    );
  }
});

test('main.js require("./…") directo está en build.files', () => {
  const patterns = pkg.build.files || [];
  const mainSrc = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const relRequires = [...mainSrc.matchAll(/require\('\.\/([^']+)'\)/g)].map((m) => m[1]);
  for (const rel of relRequires) {
    const abs = path.join(ROOT, rel);
    const resolved = fs.existsSync(abs)
      ? rel
      : fs.existsSync(`${abs}.js`)
        ? `${rel}.js`
        : fs.existsSync(`${abs}.cjs`)
          ? `${rel}.cjs`
          : rel;
    assert.ok(
      filePatternCovers(resolved, patterns),
      `Falta "${resolved}" en package.json → build.files (main.js lo requiere al iniciar)`
    );
  }
});
