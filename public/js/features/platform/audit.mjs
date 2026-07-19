/** Forensic audit, DB backup export, medication catalog merge/import. */
import { storage } from '../../storage.js';
import { isDbMode } from '../../db-storage-bridge.mjs';
import { applyMedCatalogOverlay } from '../../med-receta-core.mjs';
import { applySomePharmCatalogOverlay } from '../../med-pharm-some-catalog.mjs';
import { AUDIT_LOG_KEY } from './shared.mjs';
import { formatDateSlug, downloadJsonPayload } from './shared.mjs';
import { getPlatformRuntime } from './runtime.mjs';

const rt = getPlatformRuntime();

// ── Respaldo local (exportar / importar JSON) ─────────────────────
var _dbAuditCache = null;

function forensicEventVisible(eventType) {
  var t = String(eventType || '');
  return /^(clinical|auth|system|lan)\./.test(t);
}

function mapForensicAuditRow(row) {
  return {
    timestamp: row.timestamp,
    action: row.event_type,
    result: 'ok',
    count: 0,
    detail: row.client_id || '',
    forensicId: row.id,
    payloadHash: row.payload_hash,
    currentHash: row.current_hash,
  };
}

async function fetchDbAuditLog(limit) {
  if (!isDbMode() || !window.electronAPI || typeof window.electronAPI.dbAuditExport !== 'function') {
    return null;
  }
  try {
    var res = await window.electronAPI.dbAuditExport({ limit: limit || 200 });
    if (!res || res.ok === false) return [];
    return (res.entries || []).filter(function (row) {
      return forensicEventVisible(row.event_type);
    }).map(mapForensicAuditRow);
  } catch {
    return [];
  }
}

function getAuditLog() {
  if (isDbMode() && _dbAuditCache) return _dbAuditCache;
  try {
    var raw = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function refreshDbAuditCache() {
  if (!isDbMode()) {
    _dbAuditCache = null;
    return getAuditLog();
  }
  _dbAuditCache = await fetchDbAuditLog(200);
  return _dbAuditCache;
}

function addAuditEntry(action, result, count, detail) {
  var list = getAuditLog();
  list.unshift({
    timestamp: new Date().toISOString(),
    action: action || 'unknown',
    result: result || 'ok',
    count: Number.isFinite(count) ? count : 0,
    detail: detail || ''
  });
  if (list.length > 200) list = list.slice(0, 200);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(list));
}

async function exportAuditLog() {
  var log;
  if (isDbMode() && window.electronAPI && typeof window.electronAPI.dbAuditExport === 'function') {
    log = await fetchDbAuditLog(5000);
  } else {
    log = getAuditLog();
  }
  downloadJsonPayload(
    {
      format: isDbMode() ? 'r-plus-forensic-audit' : 'r-plus-audit-log',
      version: isDbMode() ? 2 : 1,
      exportedAt: new Date().toISOString(),
      entries: log,
    },
    'R-plus-bitacora-' + formatDateSlug(new Date()) + '.json'
  );
  rt.showToast('Bitácora exportada', 'success');
}

async function lockClinicalDatabaseNow() {
  if (!isDbMode() || !window.electronAPI || typeof window.electronAPI.dbLock !== 'function') {
    rt.showToast('Solo disponible con la base de datos cifrada en la app de escritorio.', 'error');
    return;
  }
  if (
    !window.confirm(
      '¿Bloquear la base de datos ahora? R+ la volverá a abrir automáticamente en este equipo al reiniciar o recargar.'
    )
  ) {
    return;
  }
  try {
    var res = await window.electronAPI.dbLock();
    if (!res || res.ok === false) {
      rt.showToast((res && res.error) || 'No se pudo bloquear la base de datos', 'error');
      return;
    }
    rt.showToast('Base de datos bloqueada', 'success');
    location.reload();
  } catch {
    rt.showToast('No se pudo bloquear la base de datos', 'error');
  }
}

async function verifyForensicAuditChain() {
  if (!isDbMode() || !window.electronAPI || typeof window.electronAPI.dbAuditVerify !== 'function') {
    rt.showToast('La verificación forense solo está en la app de escritorio con base cifrada.', 'error');
    return;
  }
  rt.showToast('Verificando cadena de integridad…', 'info');
  try {
    var res = await window.electronAPI.dbAuditVerify({ mode: 'full' });
    if (!res || res.ok === false) {
      rt.showToast((res && res.error) || 'No se pudo verificar la bitácora', 'error');
      return;
    }
    if (res.valid) {
      rt.showToast('Bitácora forense íntegra (verificación completa).', 'success');
    } else {
      rt.showToast(
        'Cadena comprometida: revisa el registro #' + (res.brokenAtId != null ? res.brokenAtId : '?'),
        'error'
      );
    }
  } catch {
    rt.showToast('No se pudo verificar la bitácora', 'error');
  }
}

async function exportRecoverCensusRangeJson() {
  if (
    !isDbMode() ||
    !window.electronAPI ||
    typeof window.electronAPI.dbRecoverCensusRangeExport !== 'function'
  ) {
    rt.showToast('Recuperación solo disponible con base cifrada en escritorio.', 'error');
    return;
  }
  try {
    var res = await window.electronAPI.dbRecoverCensusRangeExport();
    if (!res || res.ok === false) {
      rt.showToast((res && res.error) || 'No se encontraron pacientes para exportar', 'error');
      return;
    }
    downloadJsonPayload(
      res.payload,
      'R-plus-recuperacion-censo-' + formatDateSlug(new Date()) + '.json'
    );
    rt.showToast(
      'Exportados ' + (res.count || 0) + ' paciente(s) — importa con Importar rango…',
      'success'
    );
  } catch {
    rt.showToast('No se pudo exportar el censo recuperable', 'error');
  }
}

async function exportClinicalDbBackupJson() {
  if (!isDbMode() || !window.electronAPI || typeof window.electronAPI.dbBackupExportJson !== 'function') {
    rt.showToast('Exportación solo disponible con base cifrada en escritorio.', 'error');
    return;
  }
  if (
    !window.confirm(
      'El respaldo JSON incluye información clínica identificable en texto plano. ¿Continuar y guardar en un lugar seguro?'
    )
  ) {
    return;
  }
  try {
    var res = await window.electronAPI.dbBackupExportJson();
    if (!res || res.ok === false) {
      rt.showToast((res && res.error) || 'No se pudo exportar el respaldo', 'error');
      return;
    }
    var envelope = res.envelope || res;
    downloadJsonPayload(
      envelope,
      'R-plus-respaldo-sqlcipher-' + formatDateSlug(new Date()) + '.json'
    );
    rt.showToast('Respaldo JSON exportado', 'success');
  } catch {
    rt.showToast('No se pudo exportar el respaldo', 'error');
  }
}

async function exportClinicalDbBackupDb() {
  if (!isDbMode() || !window.electronAPI || typeof window.electronAPI.dbBackupExportDb !== 'function') {
    rt.showToast('Exportación solo disponible con base cifrada en escritorio.', 'error');
    return;
  }
  if (
    !window.confirm(
      'Se copiará el archivo .db cifrado. Protégelo como datos clínicos sensibles. ¿Continuar?'
    )
  ) {
    return;
  }
  try {
    var res = await window.electronAPI.dbBackupExportDb();
    if (res && res.canceled) return;
    if (!res || res.ok === false) {
      rt.showToast((res && res.error) || 'No se pudo exportar la copia .db', 'error');
      return;
    }
    rt.showToast('Copia .db guardada' + (res.path ? ': ' + res.path : ''), 'success');
  } catch {
    rt.showToast('No se pudo exportar la copia .db', 'error');
  }
}

var MED_CATALOG_MERGE_CAP = 400;

function mergeMedCatalogStored(incoming) {
  var cur = storage.getMedCatalog();
  var incAcc = incoming.accents && typeof incoming.accents === 'object' ? incoming.accents : {};
  var accents = Object.assign({}, cur.accents, incAcc);
  function mergeArr(a, b) {
    var seen = Object.create(null);
    var out = [];
    function add(list) {
      (list || []).forEach(function (t) {
        var s = String(t || '').trim();
        if (!s) return;
        var k = s.toUpperCase();
        if (seen[k]) return;
        seen[k] = 1;
        out.push(s);
      });
    }
    add(a);
    add(b);
    return out.slice(0, MED_CATALOG_MERGE_CAP);
  }
  var st = cur.soapTokens || {};
  var si = incoming.soapTokens && typeof incoming.soapTokens === 'object' ? incoming.soapTokens : {};
  function mergeSomePharm(curSp, incSp) {
    var out = Object.create(null);
    var cTok = curSp && curSp.tokens ? curSp.tokens : {};
    var iTok = incSp && incSp.tokens ? incSp.tokens : {};
    var keys = Object.keys(cTok).concat(Object.keys(iTok));
    keys.forEach(function (cat) {
      out[cat] = mergeArr(cTok[cat], iTok[cat]);
    });
    return { tokens: out };
  }
  return {
    v: 1,
    accents: accents,
    soapTokens: {
      vasop: mergeArr(st.vasop, si.vasop),
      abx: mergeArr(st.abx, si.abx),
      analgesia: mergeArr(st.analgesia, si.analgesia),
      antihta: mergeArr(st.antihta, si.antihta),
    },
    somePharm: mergeSomePharm(cur.somePharm, incoming.somePharm),
  };
}

function exportMedCatalogBundle() {
  var data = storage.getMedCatalog();
  downloadJsonPayload(
    {
      format: 'r-plus-med-catalog',
      version: 1,
      exportedAt: new Date().toISOString(),
      accents: data.accents || {},
      soapTokens: data.soapTokens || { vasop: [], abx: [], analgesia: [], antihta: [] },
      somePharm: data.somePharm || { tokens: {} },
    },
    'R-plus-catalogo-medicamentos-' + formatDateSlug(new Date()) + '.json'
  );
  addAuditEntry('med-catalog-export', 'ok', Object.keys(data.accents || {}).length, 'soap-export');
  rt.showToast('Catálogo exportado', 'success');
}

function triggerImportMedCatalog() {
  var el = document.getElementById('med-catalog-file-input');
  if (el) el.click();
}

function normalizeMedCatalogImportPayload(payload) {
  var accents = payload.accents;
  var soapTokens = payload.soapTokens;
  var somePharm = payload.somePharm;
  var hasAcc = accents && typeof accents === 'object';
  var hasSoap = soapTokens && typeof soapTokens === 'object';
  var hasSome = somePharm && typeof somePharm === 'object';
  if (!hasAcc && !hasSoap && !hasSome) return null;
  return {
    accents: hasAcc ? accents : {},
    soapTokens: hasSoap ? soapTokens : {},
    somePharm: hasSome ? somePharm : {},
  };
}

function finishMedCatalogImport(merged) {
  storage.saveMedCatalog(merged);
  applyMedCatalogOverlay(merged);
  applySomePharmCatalogOverlay(merged);
  var nAcc = Object.keys(merged.accents || {}).length;
  var nTok =
    (merged.soapTokens.vasop || []).length +
    (merged.soapTokens.abx || []).length +
    (merged.soapTokens.analgesia || []).length +
    (merged.soapTokens.antihta || []).length;
  addAuditEntry('med-catalog-import', 'ok', nTok, 'accents:' + nAcc);
  rt.showToast('Catálogo importado (fusionado con el tuyo)', 'success');
}

function handleMedCatalogFileText(rawText) {
  try {
    var json = JSON.parse(String(rawText || ''));
    var payload = json && typeof json === 'object' ? json : {};
    var normalized = normalizeMedCatalogImportPayload(payload);
    if (!normalized) {
      rt.showToast(
        'El archivo no es un catálogo válido (faltan accents, soapTokens o somePharm).',
        'error'
      );
      return;
    }
    finishMedCatalogImport(mergeMedCatalogStored(normalized));
  } catch {
    rt.showToast('No se pudo leer el catálogo', 'error');
  }
}

function onMedCatalogFileChosen(ev) {
  var input = ev.target;
  var f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    handleMedCatalogFileText(reader.result);
  };
  reader.readAsText(f);
}

export {
  getAuditLog,
  refreshDbAuditCache,
  addAuditEntry,
  exportAuditLog,
  lockClinicalDatabaseNow,
  verifyForensicAuditChain,
  exportClinicalDbBackupJson,
  exportRecoverCensusRangeJson,
  exportClinicalDbBackupDb,
  mergeMedCatalogStored,
  exportMedCatalogBundle,
  triggerImportMedCatalog,
  onMedCatalogFileChosen,
};
