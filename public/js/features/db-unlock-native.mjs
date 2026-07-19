/** SQLCipher is required to open the DB; argon2 is only needed for passphrase KDF. */
export function isSqlcipherNativeReady(status) {
  if (!status) return true;
  if (status.sqlcipherReady === true) return true;
  if (status.sqlcipherReady === false) return false;
  if (status.nativeReady !== false) return true;
  var failures = status.nativeFailures;
  if (!Array.isArray(failures) || !failures.length) return true;
  return !failures.some(function (f) {
    return f && f.module === 'sqlcipher';
  });
}

/** Boot retry schedule — Windows IPC/native init is slower than macOS. */
export function getClinicalBootDelays() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    var flags =
      typeof window.electronAPI.getWindowChromeFlags === 'function'
        ? window.electronAPI.getWindowChromeFlags()
        : null;
    if (flags && flags.isWindows) {
      return [0, 200, 500, 1000, 2000, 3500, 5000];
    }
  }
  return [0, 120, 300, 600, 1200];
}

function delayMs(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

export { delayMs };
