/** Pre-import automatic backup UI and restore prompt. */
import { PREIMPORT_BACKUP_KEY } from '../shared.mjs';
import { addAuditEntry } from '../audit.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { persistFullBackupPayload } from './backup-payload.mjs';

const rt = getPlatformRuntime();

function syncPreimportBackupUi() {
  var wrap = document.getElementById('settings-preimport-restore-wrap');
  if (!wrap) return;
  var raw = localStorage.getItem(PREIMPORT_BACKUP_KEY);
  var has = false;
  var meta = '';
  try {
    if (raw) {
      var p = JSON.parse(raw);
      if (p && p.format === 'r-plus-backup' && p.version === 1 && p.data) {
        has = true;
        var n = (p.data.patients || []).length;
        var when = p.exportedAt ? String(p.exportedAt).slice(0, 19).replace('T', ' ') : '';
        meta = (when ? when + ' · ' : '') + n + ' paciente(s)';
      }
    }
  } catch (_e) { void _e; }
  wrap.style.display = has ? 'block' : 'none';
  var el = document.getElementById('settings-preimport-meta');
  if (el) el.textContent = has ? meta : '—';
}

function restorePreimportBackupPrompt() {
  var raw = localStorage.getItem(PREIMPORT_BACKUP_KEY);
  if (!raw) {
    rt.showToast(
      'No hay copia automática previa a una importación. Revisa Descargas por archivos R-plus-respaldo- o R-plus-auto-respaldo-.',
      'error'
    );
    syncPreimportBackupUi();
    return;
  }
  var payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    rt.showToast('La copia automática previa está dañada.', 'error');
    return;
  }
  if (!payload || payload.format !== 'r-plus-backup' || payload.version !== 1 || !payload.data) {
    rt.showToast('Formato de respaldo no válido.', 'error');
    return;
  }
  var n = (payload.data.patients || []).length;
  if (
    !confirm(
      '¿Restaurar la copia guardada automáticamente antes de la última importación completa? (' +
        n +
        ' pacientes). La aplicación se recargará.'
    )
  ) {
    return;
  }
  if (typeof pushUndoSnapshot === 'function') rt.pushUndoSnapshot('Antes de restaurar copia pre-importación');
  persistFullBackupPayload(payload)
    .then(function () {
      addAuditEntry('preimport-restore', 'ok', n, payload.exportedAt || '');
      location.reload();
    })
    .catch(function () {
      rt.showToast('No se pudo restaurar la copia automática.', 'error');
    });
}

export { syncPreimportBackupUi, restorePreimportBackupPrompt };
