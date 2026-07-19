import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  openDraftDb,
  saveDraftConflict,
  listDraftConflicts,
  getDraftConflict,
  deleteDraftConflict,
  clearAllDraftConflicts,
  countDraftConflicts,
  __test,
} from './draft-conflict-store.mjs';

function installMinimalIndexedDB() {
  const databases = new Map();

  function openStore(dbState, storeName) {
    if (!dbState.stores.has(storeName)) {
      dbState.stores.set(storeName, new Map());
    }
    const records = dbState.stores.get(storeName);
    return {
      put(value) {
        records.set(value.id, structuredClone(value));
      },
      get(key) {
        const req = { result: records.get(key), onsuccess: null, onerror: null };
        queueMicrotask(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      },
      getAll() {
        const req = { result: [...records.values()], onsuccess: null, onerror: null };
        queueMicrotask(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      },
      delete(key) {
        records.delete(key);
      },
      createIndex() {},
    };
  }

  function connect(dbState, _dbName) {
    return {
      objectStoreNames: {
        contains(name) {
          return dbState.stores.has(name);
        },
      },
      createObjectStore(name, _opts) {
        dbState.stores.set(name, new Map());
        return openStore(dbState, name);
      },
      transaction(storeName, _mode) {
        const store = openStore(dbState, storeName);
        const tx = {
          objectStore() {
            return store;
          },
          oncomplete: null,
          onerror: null,
        };
        queueMicrotask(() => {
          if (tx.oncomplete) tx.oncomplete();
        });
        return tx;
      },
      close() {},
    };
  }

  globalThis.indexedDB = {
    open(name, version) {
      const req = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        try {
          if (!databases.has(name)) {
            databases.set(name, { version: 0, stores: new Map() });
          }
          const dbState = databases.get(name);
          const connection = connect(dbState, name);
          req.result = connection;
          if (version > dbState.version) {
            if (req.onupgradeneeded) {
              req.onupgradeneeded({ target: req });
            }
            dbState.version = version;
          }
          if (req.onsuccess) req.onsuccess({ target: req });
        } catch (err) {
          req.error = err;
          if (req.onerror) req.onerror({ target: req });
        }
      });
      return req;
    },
  };
}

beforeEach(() => {
  __test.resetMemory();
  __test.useMemoryBackend(true);
});

test('saveDraftConflict returns id and round-trips via list/get/delete', async () => {
  const id = await saveDraftConflict({
    entityType: 'patient',
    entityId: 'p1',
    conflictingKeys: ['cuarto'],
  });
  assert.ok(id);
  const list = await listDraftConflicts();
  assert.ok(list.some((d) => d.id === id));
  const got = await getDraftConflict(id);
  assert.strictEqual(got.entityType, 'patient');
  assert.strictEqual(got.entityId, 'p1');
  assert.deepStrictEqual(got.conflictingKeys, ['cuarto']);
  assert.ok(got.savedAt);
  await deleteDraftConflict(id);
  assert.strictEqual(await getDraftConflict(id), null);
  const after = await listDraftConflicts();
  assert.ok(!after.some((d) => d.id === id));
});

test('listDraftConflicts sorts by savedAt descending', async () => {
  const older = await saveDraftConflict({ entityType: 'todo', entityId: 't1' });
  await new Promise((r) => setTimeout(r, 5));
  const newer = await saveDraftConflict({ entityType: 'todo', entityId: 't2' });
  const list = await listDraftConflicts();
  assert.strictEqual(list[0].id, newer);
  assert.strictEqual(list[1].id, older);
  await deleteDraftConflict(older);
  await deleteDraftConflict(newer);
});

test('openDraftDb exercises IndexedDB transaction path', async () => {
  installMinimalIndexedDB();
  __test.useMemoryBackend(false);
  const db = await openDraftDb();
  assert.ok(db);
  db.close();
  const id = await saveDraftConflict({ entityType: 'patient', entityId: 'p2' });
  assert.ok(await getDraftConflict(id));
  await deleteDraftConflict(id);
});

test('clearAllDraftConflicts removes every row', async () => {
  await saveDraftConflict({ entityType: 'todo', entityId: 'a' });
  await saveDraftConflict({ entityType: 'todo', entityId: 'b' });
  assert.strictEqual(await clearAllDraftConflicts(), 2);
  assert.strictEqual((await listDraftConflicts()).length, 0);
});

test('countDraftConflicts matches list length', async () => {
  await saveDraftConflict({ entityType: 'todo', entityId: 'c1' });
  await saveDraftConflict({ entityType: 'todo', entityId: 'c2' });
  assert.strictEqual(await countDraftConflicts(), 2);
  assert.strictEqual(await clearAllDraftConflicts(), 2);
  assert.strictEqual(await countDraftConflicts(), 0);
});
