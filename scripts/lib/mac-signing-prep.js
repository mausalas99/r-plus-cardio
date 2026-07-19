/**
 * Preparación de firma Mac para publish sin TTY (consola Release o CI).
 * Lee RELEASE_KEYCHAIN_* y variables APPLE_* / CSC_* del entorno.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const DEFAULT_KEYCHAIN = path.join(os.homedir(), 'Library/Keychains/login.keychain-db');

function shellQuote(arg) {
  if (process.platform === 'win32') {
    return `"${String(arg).replace(/"/g, '""')}"`;
  }
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

function unlockMacKeychainFromEnv(env) {
  if (process.platform !== 'darwin') return false;
  const pw = String((env || process.env).RELEASE_KEYCHAIN_PASSWORD || '').trim();
  if (!pw) return false;
  const kc =
    String((env || process.env).RELEASE_KEYCHAIN_PATH || '').trim() || DEFAULT_KEYCHAIN;
  if (!fs.existsSync(kc)) {
    throw new Error(`No se encontró el llavero: ${kc}`);
  }
  execSync(`security unlock-keychain -p ${shellQuote(pw)} ${shellQuote(kc)}`, {
    stdio: 'pipe',
  });
  try {
    execSync(
      `security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k ${shellQuote(pw)} ${shellQuote(kc)}`,
      { stdio: 'pipe' }
    );
  } catch (_e) { /* ignored */ }
  try {
    execSync(`security set-keychain-settings -t 3600 -l ${shellQuote(kc)}`, { stdio: 'pipe' });
  } catch (_e) { /* ignored */ }
  return true;
}

function prepareMacSigning(env) {
  if (process.platform !== 'darwin') return { unlocked: false };
  const e = env || process.env;
  const unlocked = unlockMacKeychainFromEnv(e);
  const signed =
    !!String(e.CSC_LINK || '').trim() ||
    String(e.CSC_IDENTITY_AUTO_DISCOVERY || '').toLowerCase() !== 'false' ||
    !!String(e.CSC_NAME || '').trim();
  const notarize =
    e.RELEASE_SKIP_NOTARIZE !== '1' &&
    !!String(e.APPLE_ID || '').trim() &&
    !!String(e.APPLE_APP_SPECIFIC_PASSWORD || '').trim() &&
    !!String(e.APPLE_TEAM_ID || '').trim();
  return { unlocked, signed, notarize };
}

module.exports = { prepareMacSigning, unlockMacKeychainFromEnv };
