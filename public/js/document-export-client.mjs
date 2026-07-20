import { blockIfMobileDocExport, mobileDocExportToast } from './mobile-web.mjs';
import { handleOutputDirFallback } from './output-dir-fallback.mjs';
import { isOutputDirError } from './output-dir-fallback.mjs';

const DOC_EXPORT_URL_KIND = {
  '/generate': 'note',
  '/generate-indicaciones': 'indicaciones',
  '/generate-listado': 'listado',
  '/generate-ic-hoja': 'ic-hoja',
  '/generate-censo': 'censo',
  '/generate-receta-hu': 'receta-hu',
};

function canUseDesktopDocumentIpc() {
  return !!(window.electronAPI && window.electronAPI.generateDocument);
}

function documentKindForUrl(url) {
  return DOC_EXPORT_URL_KIND[String(url || '').split('?')[0]] || null;
}

async function invokeDesktopDocumentExport(kind, payload) {
  const result = await window.electronAPI.generateDocument({ kind, payload });
  if (!result || result.ok === false) {
    const err = new Error((result && result.error) || 'No se pudo generar el documento.');
    if (result && result.code) err.code = result.code;
    throw err;
  }
  return result;
}

const docExportRt = {
  showToast() {},
  getSettings() {
    return {};
  },
  loadSettings() {},
};

export function registerDocumentExportRuntime(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(docExportRt, ctx);
}

export function createGuardMobileDocExport(deps) {
  const showToast = deps && deps.showToast;
  return function guardMobileDocExport() {
    if (!blockIfMobileDocExport()) return false;
    const toast = typeof showToast === 'function' ? showToast : docExportRt.showToast;
    if (typeof toast === 'function') mobileDocExportToast(toast);
    return true;
  };
}

export function guardMobileDocExport(showToast) {
  if (typeof showToast === 'function') {
    return createGuardMobileDocExport({ showToast })();
  }
  return createGuardMobileDocExport({ showToast: docExportRt.showToast })();
}

export function saveOutputDirSelection(dir, deps) {
  if (!dir) return;
  const getSettings =
    (deps && deps.getSettings) || docExportRt.getSettings;
  const loadSettings =
    (deps && deps.loadSettings) || docExportRt.loadSettings;
  if (typeof getSettings === 'function') {
    getSettings().outputDir = dir;
    localStorage.setItem('rpc-settings', JSON.stringify(getSettings()));
  }
  syncApprovedOutputDir(dir);
  if (typeof loadSettings === 'function') loadSettings();
}

export function requestDocumentJson(url, payload) {
  const kind = documentKindForUrl(url);
  if (canUseDesktopDocumentIpc() && kind) {
    return invokeDesktopDocumentExport(kind, payload);
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.json();
  });
}

export function getOutputDirSelector() {
  if (!window.electronAPI || !window.electronAPI.selectOutputDir) return undefined;
  return function () {
    return window.electronAPI.selectOutputDir();
  };
}

export function handleDocumentGenerateResponse(opts, deps) {
  const showToast =
    (deps && deps.showToast) || docExportRt.showToast;
  const getSettings =
    (deps && deps.getSettings) || docExportRt.getSettings;
  const loadSettings =
    (deps && deps.loadSettings) || docExportRt.loadSettings;
  return handleOutputDirFallback({
    response: opts.response,
    selectOutputDir: getOutputDirSelector(),
    saveOutputDir: function (dir) {
      saveOutputDirSelection(dir, { getSettings, loadSettings });
    },
    retry: function (dir) {
      return requestDocumentJson(opts.url, opts.buildPayload(dir));
    },
    onSuccess: opts.onSuccess,
    onError: function (message) {
      if (typeof showToast === 'function') showToast('Error: ' + message, 'error');
    },
    onPrompt: function () {
      if (typeof showToast === 'function') {
        showToast('Selecciona una carpeta para guardar el documento.', 'error');
      }
    },
    onCancel: function () {
      if (typeof showToast === 'function') {
        showToast('No se guardó el documento: no se eligió carpeta.', 'error');
      }
    },
  });
}

export function parseContentDispositionFilename(header) {
  if (!header) return null;
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  return m ? m[1].replace(/"/g, '').trim() : null;
}

export async function exportGeneratedDocument({ url, buildPayload, defaultFileName }) {
  const payload = buildPayload();
  const kind = documentKindForUrl(url);

  if (canUseDesktopDocumentIpc() && kind) {
    const result = await invokeDesktopDocumentExport(kind, payload);
    const fileName = result.fileName || defaultFileName;
    if (window.electronAPI?.saveExportedDocument) {
      return window.electronAPI.saveExportedDocument({ fileName, buffer: result.buffer });
    }
    return { success: true, fileName };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'No se pudo generar el documento.');
  }
  const blob = await res.blob();
  const fileName =
    parseContentDispositionFilename(res.headers.get('Content-Disposition')) ||
    defaultFileName;

  if (window.electronAPI?.saveExportedDocument) {
    const arrayBuffer = await blob.arrayBuffer();
    return window.electronAPI.saveExportedDocument({ fileName, buffer: arrayBuffer });
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    a.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return { success: true, fileName };
}

async function persistSelectedOutputDir(dir, opts) {
  if (typeof opts.saveOutputDir === 'function') opts.saveOutputDir(dir);
  if (window.electronAPI?.setApprovedOutputDir) {
    await window.electronAPI.setApprovedOutputDir(dir);
  }
}

async function retryExportAfterOutputDirPrompt(opts, message) {
  if (typeof opts.onPrompt === 'function') opts.onPrompt(message);
  const dir = await opts.selectOutputDir();
  if (!dir) {
    if (typeof opts.onCancel === 'function') opts.onCancel(message);
    return { status: 'cancelled' };
  }
  await persistSelectedOutputDir(dir, opts);
  return exportWithOutputDirFallback(opts);
}

export async function exportWithOutputDirFallback(opts) {
  try {
    const result = await exportGeneratedDocument(opts);
    if (typeof opts.onSuccess === 'function') opts.onSuccess(result);
    return result;
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    if (typeof opts.selectOutputDir === 'function' && isOutputDirError(message)) {
      return retryExportAfterOutputDirPrompt(opts, message);
    }
    if (typeof opts.onError === 'function') {
      opts.onError(message);
      // Do not rethrow — callers often .catch() with a misleading "Error de conexión".
      return { status: 'error', error: message };
    }
    throw e;
  }
}

export function canGenerateDocumentsOffline() {
  return canUseDesktopDocumentIpc();
}

/** @returns {boolean} true when export must be blocked (no IPC and local server offline). */
export function isDocExportBlockedByLocalServer(isRpcOffline) {
  return !!isRpcOffline && !canGenerateDocumentsOffline();
}

/**
 * @param {{ isRpcOffline?: () => boolean, showToast?: (msg: string, type?: string) => void }} deps
 * @returns {boolean} true when the action was blocked
 */
export function guardDocExportBlocked(deps) {
  const offlineFn = deps && deps.isRpcOffline;
  const isOffline = typeof offlineFn === 'function' ? offlineFn() : false;
  if (!isDocExportBlockedByLocalServer(isOffline)) return false;
  const toast = (deps && deps.showToast) || docExportRt.showToast;
  if (typeof toast === 'function') {
    toast('Sin conexión con el servidor local. Reinicia R+ para generar documentos.', 'error');
  }
  return true;
}

export function syncApprovedOutputDir(dir) {
  if (window.electronAPI?.setApprovedOutputDir) {
    return window.electronAPI.setApprovedOutputDir(dir || '');
  }
  return Promise.resolve({ ok: false });
}
