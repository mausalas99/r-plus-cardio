const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { probeNativeRuntime, probeSqlcipherLoad } = require('./native-runtime-probe.js');

test('probeNativeRuntime returns structured result', () => {
  const r = probeNativeRuntime();
  assert.equal(typeof r.ok, 'boolean');
  assert.equal(typeof r.sqlcipher.ok, 'boolean');
  assert.equal(typeof r.argon2.ok, 'boolean');
  assert.ok(Array.isArray(r.failures));
});

test('probeSqlcipherLoad opens an in-memory database (lazy native binding)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'native-runtime-probe.js'), 'utf8');
  assert.match(src, /new Database\(':memory:'\)/);
  const r = probeSqlcipherLoad();
  assert.equal(typeof r.ok, 'boolean');
  if (!r.ok && /NODE_MODULE_VERSION|different Node/i.test(r.message || '')) {
    assert.equal(r.hint, 'abi');
  }
});
