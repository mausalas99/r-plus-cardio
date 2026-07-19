import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { restoreElectronBinaryFromCache, sqlcipherDestAbs, canProbeSqlcipherUnderElectron, electronAppBinaryAbs } from './sqlcipher-native.mjs';

test('canProbeSqlcipherUnderElectron requires matching platform and arch', () => {
  assert.equal(canProbeSqlcipherUnderElectron(process.platform, process.arch), true);
  if (process.platform === 'darwin') {
    const other = process.arch === 'arm64' ? 'x64' : 'arm64';
    assert.equal(canProbeSqlcipherUnderElectron('darwin', other), false);
  }
});

test('electronAppBinaryAbs points at Electron.app on darwin', () => {
  if (process.platform !== 'darwin') return;
  const p = electronAppBinaryAbs('/tmp/rplus');
  assert.match(p, /Electron\.app\/Contents\/MacOS\/Electron$/);
});

test('restoreElectronBinaryFromCache returns false when cache missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-sqlcipher-'));
  assert.equal(restoreElectronBinaryFromCache(tmp), false);
});

test('restoreElectronBinaryFromCache copies cached binary to dest', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-sqlcipher-'));
  const cacheDir = path.join(tmp, 'scripts', '.native-cache');
  const cache = path.join(cacheDir, `better_sqlite3.electron.${process.platform}-${process.arch}.node`);
  const dest = sqlcipherDestAbs(tmp);
  const payload = Buffer.from('cached-electron-binary');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cache, payload);
  assert.equal(restoreElectronBinaryFromCache(tmp), true);
  assert.deepEqual(fs.readFileSync(dest), payload);
});
