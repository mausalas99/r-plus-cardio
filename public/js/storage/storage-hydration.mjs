import { invalidateParsed, getBlobCache, setBlobCache } from './storage-core.mjs';
import { isDbMode, hydrateStorageCache } from '../db-storage-bridge.mjs';

export async function ensureStorageHydrated() {
  if (!isDbMode()) return;
  if (getBlobCache()) return;
  if (
    typeof window !== 'undefined' &&
    window.electronAPI &&
    typeof window.electronAPI.dbStatus === 'function'
  ) {
    try {
      var st = await window.electronAPI.dbStatus();
      if (st && st.state === 'locked') return;
    } catch {
      return;
    }
  }
  try {
    setBlobCache(await hydrateStorageCache());
    invalidateParsed();
  } catch {
    setBlobCache(null);
    invalidateParsed();
  }
}

/** @internal tests */
export function clearBlobCacheForTests() {
  setBlobCache(null);
  invalidateParsed();
}
