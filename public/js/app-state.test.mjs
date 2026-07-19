import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
const mockStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});
globalThis.window = { localStorage: mockStorage };

const { storage } = await import('./storage.js');
const appState = await import('./app-state.mjs');

describe('app-state', () => {
  beforeEach(() => {
    store = {};
    appState.setSaveStateHooks({ before: null, after: null });
    appState.initAppState();
  });

  it('initAppState loads patients from storage', () => {
    store['rpc-patients'] = JSON.stringify([{ id: 'p1', name: 'Ana' }]);
    appState.initAppState();
    assert.strictEqual(appState.patients.length, 1);
    assert.strictEqual(appState.patients[0].id, 'p1');
  });

  it('saveState immediate calls storage.saveAll', async () => {
    let calls = 0;
    const orig = storage.saveAll.bind(storage);
    storage.saveAll = (...args) => {
      calls += 1;
      return orig(...args);
    };
    appState.setPatients([{ id: 'p1', name: 'Test' }]);
    await appState.saveState({ immediate: true });
    assert.strictEqual(calls, 1);
    storage.saveAll = orig;
  });

  it('saveState runs after hook on immediate save', async () => {
    let ran = false;
    appState.setSaveStateHooks({ after() { ran = true; } });
    await appState.saveState({ immediate: true });
    assert.strictEqual(ran, true);
  });

  it('replaceAppStateFromBackupData + flushSaveState persists imported patients', async () => {
    appState.replaceAppStateFromBackupData({
      patients: [{ id: 'p2', nombre: 'Luis' }],
      notes: { p2: { estudios: 'x' } },
    });
    await appState.flushSaveState();
    const fromStorage = storage.getPatients();
    assert.strictEqual(fromStorage.length, 1);
    assert.strictEqual(fromStorage[0].id, 'p2');
  });

  it('localStorage-only import is wiped by flushSaveState when memory is empty', async () => {
    store['rpc-patients'] = JSON.stringify([{ id: 'imported', nombre: 'X' }]);
    assert.strictEqual(appState.patients.length, 0);
    await appState.flushSaveState();
    assert.strictEqual(storage.getPatients().length, 0);
  });

  it('flushSaveState runs again after an in-flight save when queued', async () => {
    const orig = storage.saveAll.bind(storage);
    let calls = 0;
    let release;
    storage.saveAll = (...args) => {
      calls += 1;
      if (calls === 1) {
        return new Promise(function (resolve) {
          release = function () {
            resolve(orig(...args));
          };
        });
      }
      return orig(...args);
    };
    appState.setPatients([{ id: 'p1', name: 'A' }]);
    const first = appState.saveState({ immediate: true });
    appState.setPatients([{ id: 'p1', name: 'B' }]);
    const flushed = appState.flushSaveState();
    assert.ok(release);
    release();
    await Promise.all([first, flushed]);
    assert.ok(calls >= 2);
    storage.saveAll = orig;
  });

  it('flushSaveState persists without debounce wait', async () => {
    const orig = storage.saveAll.bind(storage);
    let calls = 0;
    storage.saveAll = (...args) => {
      calls += 1;
      return orig(...args);
    };
    appState.setPatients([{ id: 'p1', name: 'Test' }]);
    appState.saveState();
    await appState.flushSaveState();
    assert.ok(calls >= 1);
    storage.saveAll = orig;
  });

  it('bootHydrateFromDb loads patients from hydrated blob cache', async () => {
    const { clearBlobCacheForTests } = await import('./storage.js');
    clearBlobCacheForTests();
    globalThis.window = {
      localStorage: mockStorage,
      electronAPI: {
        dbStatus: async () => ({ ok: true, state: 'unlocked' }),
        dbClinicalLoadAll: async () => ({
          ok: true,
          blobs: { patients: JSON.stringify([{ id: 'boot1', nombre: 'Boot' }]) },
        }),
        dbClinicalSaveAll: async () => ({ ok: true }),
      },
    };
    appState.setPatients([]);
    await appState.bootHydrateFromDb();
    assert.strictEqual(appState.patients.length, 1);
    assert.strictEqual(appState.patients[0].id, 'boot1');
    clearBlobCacheForTests();
    globalThis.window = { localStorage: mockStorage };
  });
});
