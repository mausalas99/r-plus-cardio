/**
 * Startup probes for native addons (SQLCipher + argon2).
 * Used by main process and release verification.
 */

function probeArgon2Load() {
  try {
    const { hashRaw } = require('@node-rs/argon2');
    if (typeof hashRaw !== 'function') {
      return { ok: false, module: 'argon2', message: 'Argon2 export missing' };
    }
    return { ok: true, module: 'argon2' };
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    return {
      ok: false,
      module: 'argon2',
      message: msg,
      hint:
        /failed to load native binding|Cannot find module.*\.node/i.test(msg)
          ? 'argon2'
          : 'unknown',
    };
  }
}

function probeSqlcipherLoad() {
  try {
    const Database = require('better-sqlite3-multiple-ciphers');
    const db = new Database(':memory:');
    db.close();
    return { ok: true, module: 'sqlcipher' };
  } catch (e) {
    const msg = e && e.message ? String(e.message) : String(e);
    return {
      ok: false,
      module: 'sqlcipher',
      message: msg,
      hint: /NODE_MODULE_VERSION|different Node/i.test(msg) ? 'abi' : 'missing',
    };
  }
}

function probeNativeRuntime() {
  const sqlcipher = probeSqlcipherLoad();
  const argon2 = probeArgon2Load();
  const ok = sqlcipher.ok && argon2.ok;
  const failures = [];
  if (!sqlcipher.ok) failures.push(sqlcipher);
  if (!argon2.ok) failures.push(argon2);
  let userMessage =
    'R+ no pudo cargar un componente nativo necesario en esta instalación.';
  if (failures.some((f) => f.module === 'argon2' && f.hint === 'argon2')) {
    userMessage =
      'R+ no pudo cargar el módulo de cifrado (argon2). Suele ocurrir en Mac Intel si el instalador no incluyó el binario correcto. Reinstala desde GitHub o restaura una versión estable anterior en Ajustes.';
  } else if (failures.some((f) => f.hint === 'abi')) {
    userMessage =
      'El módulo de base de datos no coincide con esta versión de R+. Reinstala el instalador más reciente desde GitHub.';
  }
  return { ok, sqlcipher, argon2, failures, userMessage };
}

module.exports = {
  probeArgon2Load,
  probeSqlcipherLoad,
  probeNativeRuntime,
};
