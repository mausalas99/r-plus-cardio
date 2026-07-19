/** Shared keys and download helpers for platform submodules. */
export const AUDIT_LOG_KEY = 'rpc-audit-log';
export const AUTO_BACKUP_SETTINGS_KEY = 'rpc-auto-backup-settings';
export const AUTO_BACKUP_INDEX_KEY = 'rpc-auto-backup-index';
export const AUTO_BACKUP_MAX = 14;
export const PREIMPORT_BACKUP_KEY = 'rpc-preimport-backup';
export const IDLE_LOCK_LS_KEY = 'rpc-idle-lock';
export const IDLE_LOCK_HASH_LS_KEY = 'rpc-idle-lock-hash';
export const IDLE_LOCK_DEBOUNCE_MS = 500;
export const IDLE_LOCK_VALID_MINUTES = [0, 5, 10, 30];

export function formatDateSlug(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function downloadBlob(blob, fileName) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function downloadJsonPayload(payload, fileName) {
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, fileName);
}

export function downloadTextPayload(content, fileName, mimeType) {
  var blob = new Blob([content], { type: (mimeType || 'text/plain') + ';charset=utf-8' });
  downloadBlob(blob, fileName);
}
