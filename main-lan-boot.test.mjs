/**
 * Static checks for BN-01 main-process boot: parallel unlock + startLanServer before window.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAIN_SRC = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');

function whenReadyBody(src) {
  const start = src.indexOf('app.whenReady().then(async () => {');
  assert.ok(start >= 0, 'app.whenReady block missing');
  const end = src.indexOf('app.on(\'window-all-closed\'', start);
  assert.ok(end > start, 'window-all-closed handler missing');
  return src.slice(start, end);
}

test('main boot: clinical DB unlock finishes before createWindow', () => {
  const body = whenReadyBody(MAIN_SRC);
  const createIdx = body.indexOf('createWindow()');
  assert.ok(createIdx >= 0, 'createWindow in whenReady');
  assert.ok(MAIN_SRC.includes('unlockClinicalDbAtStartup'), 'clinical DB unlock helper defined');
  assert.ok(
    MAIN_SRC.includes('await dbManager.ensureUnlocked'),
    'ensureUnlocked invoked from startup helper'
  );
  assert.ok(body.includes('unlockClinicalDbAtStartup(dbManager)'), 'helper used in whenReady');
  const awaitUnlock = body.indexOf('await unlockPromise');
  assert.ok(awaitUnlock >= 0 && awaitUnlock < createIdx, 'await unlockPromise before createWindow');
});

test('main boot: LAN server via startLanServer before createWindow', () => {
  const body = whenReadyBody(MAIN_SRC);
  const createIdx = body.indexOf('createWindow()');
  assert.ok(createIdx >= 0, 'createWindow in whenReady');
  assert.ok(
    !/\bawait\s+require\s*\(\s*['"]\.\/server['"]\s*\)/.test(body),
    'bare await require("./server") removed'
  );
  const startIdx = body.indexOf('startLanServer');
  assert.ok(startIdx >= 0, 'startLanServer used in whenReady');
  assert.ok(startIdx < createIdx, 'startLanServer before createWindow');
  assert.ok(body.includes('await lanServer.startLanServer'), 'awaits startLanServer before window');
});

test('main boot: lan-ensure-server-ready IPC registered', () => {
  assert.ok(
    MAIN_SRC.includes("ipcMain.handle('lan-ensure-server-ready'"),
    'lan-ensure-server-ready handler'
  );
});

test('main window.open uses http(s) allowlist', () => {
  assert.ok(MAIN_SRC.includes('isAllowedExternalUrl'), 'window-open policy helper');
  assert.ok(MAIN_SRC.includes('setWindowOpenHandler'), 'setWindowOpenHandler present');
  const handlerStart = MAIN_SRC.indexOf('setWindowOpenHandler');
  const handlerSlice = MAIN_SRC.slice(handlerStart, handlerStart + 280);
  assert.ok(handlerSlice.includes('isAllowedExternalUrl(url)'), 'handler gates on allowlist');
});

test('main quit: destroy windows before LAN server stop', () => {
  const quitStart = MAIN_SRC.indexOf("app.on('before-quit'");
  assert.ok(quitStart >= 0, 'before-quit handler');
  const quitBlock = MAIN_SRC.slice(quitStart, quitStart + 900);
  const destroyIdx = quitBlock.indexOf('destroyAllBrowserWindows');
  const stopIdx = quitBlock.indexOf('stopLanServer');
  assert.ok(destroyIdx >= 0, 'destroyAllBrowserWindows in quit path');
  assert.ok(stopIdx > destroyIdx, 'destroy windows before stopLanServer');
  assert.ok(quitBlock.includes('app.exit(0)'), 'hard exit after shutdown');
});
