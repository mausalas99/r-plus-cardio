const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PERF_CONFIG_FILE, normalizePerfConfig, readPerfConfig, writePerfConfig } = require('./perf-config.js');

test('normalizePerfConfig: default es aceleración activada', () => {
  assert.deepEqual(normalizePerfConfig(null), { hardwareAcceleration: true });
  assert.deepEqual(normalizePerfConfig(undefined), { hardwareAcceleration: true });
  assert.deepEqual(normalizePerfConfig({}), { hardwareAcceleration: true });
  assert.deepEqual(normalizePerfConfig('basura'), { hardwareAcceleration: true });
});

test('normalizePerfConfig: solo false explícito desactiva', () => {
  assert.deepEqual(normalizePerfConfig({ hardwareAcceleration: false }), { hardwareAcceleration: false });
  assert.deepEqual(normalizePerfConfig({ hardwareAcceleration: 'no' }), { hardwareAcceleration: true });
  assert.deepEqual(normalizePerfConfig({ hardwareAcceleration: 0 }), { hardwareAcceleration: true });
});

test('readPerfConfig: archivo ausente → default activado', () => {
  const fakeFs = {
    readFileSync() {
      throw new Error('ENOENT');
    },
  };
  assert.deepEqual(readPerfConfig(fakeFs, '/x/performance.json'), { hardwareAcceleration: true });
});

test('readPerfConfig: JSON corrupto → default activado', () => {
  const fakeFs = { readFileSync: () => '{nope' };
  assert.deepEqual(readPerfConfig(fakeFs, '/x/performance.json'), { hardwareAcceleration: true });
});

test('readPerfConfig: opt-out persistido se respeta', () => {
  const fakeFs = { readFileSync: () => JSON.stringify({ hardwareAcceleration: false }) };
  assert.deepEqual(readPerfConfig(fakeFs, '/x/performance.json'), { hardwareAcceleration: false });
});

test('writePerfConfig: persiste valor normalizado', () => {
  let written = '';
  const fakeFs = {
    writeFileSync(_path, data) {
      written = data;
    },
  };
  const cfg = writePerfConfig(fakeFs, '/x/performance.json', { hardwareAcceleration: false });
  assert.deepEqual(cfg, { hardwareAcceleration: false });
  assert.equal(written, JSON.stringify({ hardwareAcceleration: false }));
});

test('writePerfConfig: activar escribe true explícito', () => {
  let written = '';
  const fakeFs = {
    writeFileSync(_path, data) {
      written = data;
    },
  };
  const cfg = writePerfConfig(fakeFs, '/x/performance.json', { hardwareAcceleration: true });
  assert.deepEqual(cfg, { hardwareAcceleration: true });
  assert.equal(written, JSON.stringify({ hardwareAcceleration: true }));
});

test('PERF_CONFIG_FILE: nombre estable del archivo en userData', () => {
  assert.equal(PERF_CONFIG_FILE, 'performance.json');
});
