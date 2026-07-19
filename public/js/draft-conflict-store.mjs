const DB_NAME = 'rplus-clinical';
const STORE = 'draft-conflicts';
const DB_VERSION = 1;

function memoryStore() {
  return __test._memory;
}

export function openDraftDb() {
  const idb = globalThis.indexedDB;
  if (!idb) {
    return Promise.reject(new Error('indexedDB_unavailable'));
  }
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('savedAt', 'savedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(row) {
  const db = await openDraftDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

async function idbGetAll() {
  const db = await openDraftDb();
  const rows = await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return rows;
}

async function idbGet(id) {
  const db = await openDraftDb();
  const row = await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => res(req.result ?? null);
    req.onerror = () => rej(req.error);
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return row;
}

async function idbDelete(id) {
  const db = await openDraftDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

function sortBySavedAtDesc(rows) {
  return rows.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

export async function saveDraftConflict(record) {
  const id = globalThis.crypto.randomUUID();
  const row = { ...record, id, savedAt: new Date().toISOString() };
  const mem = memoryStore();
  if (mem) {
    mem.set(id, row);
    return id;
  }
  await idbPut(row);
  return id;
}

export async function listDraftConflicts() {
  const mem = memoryStore();
  if (mem) {
    return sortBySavedAtDesc([...mem.values()]);
  }
  return sortBySavedAtDesc(await idbGetAll());
}

/** Count drafts without loading full records (safe for large stores). */
export async function countDraftConflicts() {
  const mem = memoryStore();
  if (mem) return mem.size;
  const db = await openDraftDb();
  const n = await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => res(Number(req.result || 0));
    req.onerror = () => rej(req.error);
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return n;
}

export async function getDraftConflict(id) {
  if (!id) return null;
  const mem = memoryStore();
  if (mem) {
    return mem.get(id) ?? null;
  }
  return idbGet(id);
}

export async function deleteDraftConflict(id) {
  if (!id) return;
  const mem = memoryStore();
  if (mem) {
    mem.delete(id);
    return;
  }
  await idbDelete(id);
}

/** Remove every saved conflict draft (IndexedDB or test memory backend). */
export async function clearAllDraftConflicts() {
  const mem = memoryStore();
  if (mem) {
    const n = mem.size;
    mem.clear();
    return n;
  }
  const n = await countDraftConflicts();
  if (!n) return 0;
  const db = await openDraftDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return n;
}

/** @internal Test hooks — in-memory backend when IndexedDB is unavailable in node:test. */
export const __test = {
  _memory: null,
  useMemoryBackend(enabled = true) {
    __test._memory = enabled ? new Map() : null;
  },
  resetMemory() {
    __test._memory?.clear();
  },
};
