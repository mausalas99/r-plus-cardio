/**
 * Exit 0 when better-sqlite3-multiple-ciphers loads under Electron's ABI.
 * Used by scripts/rebuild-native-db.mjs — not for direct use.
 */
const { probeSqlcipherLoad } = require('../lib/native-runtime-probe.js');

const result = probeSqlcipherLoad();
if (!result.ok) {
  console.error(result.message || 'sqlcipher probe failed');
  process.exit(1);
}

// Success path must exit — otherwise Electron keeps running (blank dock icon).
process.exit(0);
