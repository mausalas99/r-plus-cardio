/** File-input handlers for full, patient, range, and demo backup import. */
import { saveState } from '../../../app-state.mjs';
import {
  describePatientImportRejection,
  parsePatientImportJsonText,
} from '../../../patient-export-format.mjs';
import { addAuditEntry } from '../audit.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { buildFullBackupPayload, persistFullBackupPayload } from './backup-payload.mjs';
import { normalizeFullBackupImportPayload } from './backup-host-merge.mjs';
import { importEntriesWithConflicts, importPatientExportPayloads } from './import-core.mjs';

const rt = getPlatformRuntime();

function triggerImportRangeBackup() {
  var input = document.getElementById('range-backup-file-input');
  if (input) input.click();
}

function onRangeBackupFileChosen(ev) {
  var f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function() {
    try {
      var payload = JSON.parse(reader.result);
      if (!payload || payload.format !== 'r-plus-range-export' || payload.version !== 1 || !Array.isArray(payload.entries)) {
        rt.showToast('Archivo de rango inválido.', 'error');
        return;
      }
      if (typeof pushUndoSnapshot === 'function') rt.pushUndoSnapshot('Importar rango (' + payload.entries.length + ')');
      var res = importEntriesWithConflicts(payload.entries, 'range-import');
      if (res.cancelled) {
        rt.showToast('Importación cancelada', 'error');
      } else {
        rt.showToast('Rango importado: ' + (res.imported + res.overwritten + res.duplicated), 'success');
      }
    } catch {
      rt.showToast('No se pudo leer el archivo de rango.', 'error');
      addAuditEntry('range-import', 'error', 0, 'read-error');
    }
  };
  reader.readAsText(f);
}

function triggerImportBackup() {
  document.getElementById('backup-file-input').click();
}

function triggerImportActivePatientBackup() {
  var input = document.getElementById('patient-backup-file-input');
  if (input) input.click();
}

function onPatientBackupFileChosen(ev) {
  var f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function() {
    try {
      var result = parsePatientImportJsonText(reader.result);
      var parsed = result.parsed;
      var payloads = result.payloads;
      if (!payloads.length) {
        rt.showToast(
          'El archivo no es una exportación válida de paciente. ' + describePatientImportRejection(parsed),
          'error'
        );
        return;
      }
      importPatientExportPayloads(payloads, f.name + ':');
    } catch {
      rt.showToast('No se pudo leer la exportación de paciente.', 'error');
      addAuditEntry('backup-patient-import', 'error', 0, 'read-error');
    }
  };
  reader.readAsText(f);
}

async function importBundledDemoPatients() {
  var files = ['demo-perez.json'];
  var payloads = [];
  for (var i = 0; i < files.length; i += 1) {
    var name = files[i];
    try {
      var res = await fetch('demo-patients/' + name, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var result = parsePatientImportJsonText(await res.text());
      payloads = payloads.concat(result.payloads);
    } catch {
      rt.showToast(
        'No se encontró ' +
          name +
          ' en la app. Regenera con npm run export:demo-patients y npm run build:ui.',
        'error'
      );
      return;
    }
  }
  if (!payloads.length) {
    rt.showToast('Los JSON demo no tienen formato de importación válido.', 'error');
    return;
  }
  importPatientExportPayloads(payloads, 'bundled:');
}

function importBundledDemoPerez() {
  importBundledDemoPatients();
}

async function importBundledDemoIc() {
  var name = 'demo-ic-seguimiento.json';
  try {
    var res = await fetch('demo-patients/' + name, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var result = parsePatientImportJsonText(await res.text());
    if (!result.payloads.length) {
      rt.showToast('El JSON demo IC no tiene formato de importación válido.', 'error');
      return;
    }
    importPatientExportPayloads(result.payloads, 'bundled-ic:');
  } catch {
    rt.showToast(
      'No se encontró ' + name + ' en la app. Copia data/demo-patients a public/demo-patients y npm run build:ui.',
      'error'
    );
  }
}

function buildFullBackupConfirmMsg(n) {
  var confirmMsg =
    'Esto reemplaza todos los pacientes y datos locales en esta computadora (' +
    n +
    ' pacientes en el archivo). No se puede deshacer.';
  if (n === 0) {
    confirmMsg +=
      '\n\nEl archivo no trae pacientes (solo ajustes/plantillas). Si esperabas pacientes, pide un respaldo nuevo desde el equipo origen.';
  }
  return confirmMsg + '\n\n¿Continuar?';
}

function reportFullBackupImportError(err) {
  var code = err && err.message;
  if (code === 'SAVE_FAILED' || code === 'QUOTA_EXCEEDED') {
    rt.showToast(
      'No se pudo guardar el respaldo: almacenamiento local lleno. Libera espacio e intenta de nuevo.',
      'error'
    );
  } else {
    rt.showToast('No se pudo leer el respaldo', 'error');
  }
  addAuditEntry('backup-full-import', 'error', 0, code || 'read-error');
}

async function processFullBackupFile(rawPayload) {
  const payload = normalizeFullBackupImportPayload(rawPayload);
  if (!payload) {
    rt.showToast('El archivo no es un respaldo válido de R+', 'error');
    return;
  }
  var n = (payload.data.patients || []).length;
  if (!confirm(buildFullBackupConfirmMsg(n))) return;
  if (typeof pushUndoSnapshot === 'function') rt.pushUndoSnapshot('Importar respaldo completo');
  await saveState({ immediate: true });
  try {
    localStorage.setItem('rpc-preimport-backup', JSON.stringify(buildFullBackupPayload()));
  } catch (_e) { void _e; }
  await persistFullBackupPayload(payload);
  addAuditEntry('backup-full-import', 'ok', n, '');
  rt.showToast(
    'Respaldo importado (' + n + ' paciente' + (n === 1 ? '' : 's') + '). Recargando…',
    'success'
  );
  location.reload();
}

function onBackupFileChosen(ev) {
  var f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = async function() {
    try {
      await processFullBackupFile(JSON.parse(reader.result));
    } catch (err) {
      reportFullBackupImportError(err);
    }
  };
  reader.readAsText(f);
}

export {
  triggerImportRangeBackup,
  onRangeBackupFileChosen,
  triggerImportBackup,
  triggerImportActivePatientBackup,
  onPatientBackupFileChosen,
  importBundledDemoPerez,
  importBundledDemoIc,
  onBackupFileChosen,
};
