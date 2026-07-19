/**
 * Exit 0 when packaged app.asar.unpacked sqlcipher loads under Electron.
 * Usage: npx electron scripts/probe-packaged-sqlcipher.cjs [path-to-R+.app]
 */
const path = require('path');
const fs = require('fs');

const appRoot =
  process.argv[2] ||
  path.join(__dirname, '..', 'dist', 'mac-arm64', 'R+.app');

const modRoot = path.join(
  appRoot,
  'Contents',
  'Resources',
  'app.asar.unpacked',
  'node_modules',
  'better-sqlite3-multiple-ciphers'
);

if (!fs.existsSync(modRoot)) {
  console.error('Missing packaged module:', modRoot);
  process.exit(1);
}

try {
  const D = require(modRoot);
  const db = new D(':memory:');
  db.close();
  console.log('packaged sqlcipher OK:', modRoot);
  process.exit(0);
} catch (e) {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
}
