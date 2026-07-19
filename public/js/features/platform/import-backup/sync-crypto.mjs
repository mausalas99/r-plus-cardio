/** Encrypted sync bundle export/import and WebCrypto helpers. */
import { patients } from '../../../app-state.mjs';
import { formatDateSlug, downloadJsonPayload } from '../shared.mjs';
import { addAuditEntry } from '../audit.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { buildPatientEntry } from '../../patients.mjs';
import { importEntriesWithConflicts } from './import-core.mjs';

const rt = getPlatformRuntime();

function bytesToBase64(bytes) {
  var binary = '';
  for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64) {
  var binary = atob(base64);
  var out = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function encryptSyncPayload(obj, passphrase) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('WebCrypto no disponible');
  var enc = new TextEncoder();
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  var key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  var plain = enc.encode(JSON.stringify(obj));
  var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
  return {
    encrypted: true,
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 120000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted))
  };
}

async function decryptSyncPayload(payload, passphrase) {
  if (!window.crypto || !window.crypto.subtle) throw new Error('WebCrypto no disponible');
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  var key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(payload.salt), iterations: payload.iterations || 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  var plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext)
  );
  return JSON.parse(dec.decode(plainBuffer));
}

function collectSyncEntries() {
  var entries = [];
  patients.forEach(function(p) {
    var entry = buildPatientEntry(p.id);
    if (entry) entries.push(entry);
  });
  return entries;
}

async function exportSyncBundlePrompt() {
  var entries = collectSyncEntries();
  if (!entries.length) {
    rt.showToast('No hay datos para sincronizar.', 'error');
    return;
  }
  var passphrase = prompt('Passphrase opcional para cifrar (deja vacío para sin cifrado):', '');
  var base = {
    format: 'r-plus-sync-bundle',
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: window.__RPC_APP_VERSION__ || null
  };
  if (passphrase && String(passphrase).trim()) {
    try {
      base.payload = await encryptSyncPayload({ entries: entries }, String(passphrase));
    } catch {
      rt.showToast('No se pudo cifrar: WebCrypto no disponible.', 'error');
      addAuditEntry('sync-export', 'error', 0, 'crypto-unavailable');
      return;
    }
  } else {
    base.payload = { encrypted: false, entries: entries };
  }
  downloadJsonPayload(base, 'R-plus-sync-' + formatDateSlug(new Date()) + '.json');
  addAuditEntry('sync-export', 'ok', entries.length, base.payload.encrypted ? 'encrypted' : 'plain');
  rt.showToast('Paquete sync exportado', 'success');
}

function triggerImportSyncBundle() {
  var input = document.getElementById('sync-bundle-file-input');
  if (input) input.click();
}

function onSyncBundleFileChosen(ev) {
  var f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = async function() {
    try {
      var bundle = JSON.parse(reader.result);
      if (!bundle || bundle.format !== 'r-plus-sync-bundle' || bundle.version !== 1 || !bundle.payload) {
        rt.showToast('Paquete sync inválido.', 'error');
        return;
      }
      var data = bundle.payload;
      if (data.encrypted) {
        var passphrase = prompt('Este paquete está cifrado. Ingresa la passphrase:', '');
        if (!passphrase) {
          rt.showToast('Importación cancelada.', 'error');
          addAuditEntry('sync-import', 'cancelled', 0, 'no-passphrase');
          return;
        }
        data = await decryptSyncPayload(data, passphrase);
      }
      if (!data || !Array.isArray(data.entries)) {
        rt.showToast('Contenido sync inválido.', 'error');
        addAuditEntry('sync-import', 'error', 0, 'invalid-content');
        return;
      }
      if (typeof pushUndoSnapshot === 'function') rt.pushUndoSnapshot('Importar paquete sync (' + data.entries.length + ')');
      var res = importEntriesWithConflicts(data.entries, 'sync-import');
      if (res.cancelled) rt.showToast('Sync cancelado', 'error');
      else rt.showToast('Sync importado: ' + (res.imported + res.overwritten + res.duplicated), 'success');
    } catch {
      rt.showToast('No se pudo importar el paquete sync.', 'error');
      addAuditEntry('sync-import', 'error', 0, 'read-error');
    }
  };
  reader.readAsText(f);
}

export {
  bytesToBase64,
  base64ToBytes,
  encryptSyncPayload,
  decryptSyncPayload,
  collectSyncEntries,
  exportSyncBundlePrompt,
  triggerImportSyncBundle,
  onSyncBundleFileChosen,
};
