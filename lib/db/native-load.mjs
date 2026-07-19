import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export function loadNativeDatabase() {
  try {
    return require('better-sqlite3-multiple-ciphers');
  } catch (e) {
    throw toNativeLoadError(e);
  }
}

/** @returns {{ ok: true } | { ok: false, code: string, message: string }} */
export function probeNativeDatabaseLoad() {
  try {
    loadNativeDatabase();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      code: e?.code || 'DB_NATIVE_ABI_MISMATCH',
      message: e?.message || 'Native database module failed to load',
    };
  }
}

/** @param {unknown} e */
function toNativeLoadError(e) {
  const msg = e && e.message ? String(e.message) : '';
  const err = new Error(
    /NODE_MODULE_VERSION|was compiled against a different/i.test(msg)
      ? msg
      : 'Native database module failed to load'
  );
  err.code = 'DB_NATIVE_ABI_MISMATCH';
  err.cause = e;
  return err;
}
