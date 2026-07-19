/**
 * Entregas activas cuyo expediente ya no está en el censo local (borrado o solo LAN).
 */
import { patients, saveState } from './app-state.mjs';
import { clinicalSessionContext, refreshGuardiaCensusFromDb } from './clinical-access-runtime.mjs';
import { vitalsMonitorAlertState } from './features/session-manager.mjs';

import { escapeHtml, escapeAttr } from './dom-escape.mjs';
function dbApi() {
  return typeof window !== 'undefined' ? window.rplusDb || window.electronAPI || null : null;
}

function toast(msg, type = 'info') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(msg, type);
  }
}

function patientInLocalCensus(patientId) {
  const id = String(patientId || '').trim();
  if (!id) return false;
  return patients.some((p) => p && String(p.id) === id);
}

/** @param {object} row */
function vitalsHintForRow(row) {
  const alert = vitalsMonitorAlertState(row);
  if (!alert) return 'Sin alerta de signos activa';
  if (alert.level === 'overdue') {
    return `Signos vencidos (${alert.freqLabel})`;
  }
  return `Signos pronto (${alert.freqLabel})`;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {{ settings?: Record<string, unknown>|null }} [opts]
 */
export function renderOrphanEntregasStrip(rows, opts = {}) {
  const host = document.getElementById('guardia-orphan-entregas-strip');
  if (!host) return;

  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  const cards = list
    .map((row) => {
      const patientId = String(row.patient_id || '');
      const guardiaId = String(row.guardia_id || '');
      const vitalsHint = vitalsHintForRow(row);
      const shortId =
        patientId.length > 14 ? `${patientId.slice(0, 6)}…${patientId.slice(-4)}` : patientId;
      return `<li class="guardia-orphan-row">
        <div class="guardia-orphan-row-main">
          <span class="guardia-orphan-id" title="${escapeAttr(patientId)}">${escapeHtml(shortId)}</span>
          <span class="guardia-orphan-vitals">${escapeHtml(vitalsHint)}</span>
        </div>
        <div class="guardia-orphan-row-actions">
          <button type="button" class="btn-med-secondary guardia-orphan-open-btn"
            data-patient-id="${escapeAttr(patientId)}"
            data-guardia-id="${escapeAttr(guardiaId)}">Abrir</button>
          <button type="button" class="btn-med-secondary guardia-orphan-delete-btn"
            data-patient-id="${escapeAttr(patientId)}"
            data-guardia-id="${escapeAttr(guardiaId)}">Eliminar del servidor</button>
        </div>
      </li>`;
    })
    .join('');

  host.hidden = false;
  host.innerHTML = `
    <details class="guardia-orphan-details" open>
      <summary class="guardia-orphan-summary">
        Entregas sin expediente local
        <span class="guardia-orphan-count">${list.length}</span>
      </summary>
      <p class="guardia-orphan-hint">
        Estas entregas siguen en ⇄ pero el paciente ya no está en tu censo.
        Abrir recupera el expediente del anfitrión cuando sea posible; Eliminar del servidor borra el paciente en ⇄ y libera la entrega.
      </p>
      <ul class="guardia-orphan-list">${cards}</ul>
    </details>`;

  host.querySelectorAll('.guardia-orphan-open-btn').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement) || btn._orphanOpenWired) return;
    btn._orphanOpenWired = true;
    btn.addEventListener('click', () => {
      void openOrphanEntrega(btn, opts.settings ?? null);
    });
  });

  host.querySelectorAll('.guardia-orphan-delete-btn').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement) || btn._orphanDeleteWired) return;
    btn._orphanDeleteWired = true;
    btn.addEventListener('click', () => {
      void deleteOrphanFromServer(btn, opts.settings ?? null);
    });
  });
}

/** @param {string} patientId */
async function tryRestoreOrphanPatientFromLan(patientId) {
  if (patientInLocalCensus(patientId)) return;
  const lan = await import('./features/lan-sync.mjs');
  if (typeof lan.getActiveLiveSyncRoomId !== 'function' || !lan.getActiveLiveSyncRoomId()) return;
  const restored =
    typeof lan.restoreLanPatientFromHost === 'function'
      ? await lan.restoreLanPatientFromHost(patientId)
      : null;
  if (restored?.ok) {
    toast('Expediente recuperado del anfitrión.', 'success');
    return;
  }
  if (restored?.error === 'patient_not_on_host') {
    toast('El anfitrión no tiene este expediente; se abre la entrega con datos limitados.', 'warn');
    return;
  }
  if (restored && !restored.ok) {
    toast('No se pudo recuperar el expediente del anfitrión.', 'warn');
  }
}

/** @param {string} patientId */
async function openEntregaForOrphan(patientId, guardiaId) {
  const entrega = await import('./features/clinical-entrega.mjs');
  if (typeof entrega.openEntregaModal !== 'function') return;
  entrega.openEntregaModal({ patientId, guardiaId });
}

/** @param {string} patientId */
function selectOrphanPatientIfLocal(patientId) {
  if (!patientInLocalCensus(patientId)) return;
  if (typeof window.selectPatient === 'function') {
    window.selectPatient(patientId);
  }
}

/** @param {HTMLButtonElement} btn @param {Record<string, unknown>|null} settings */
async function openOrphanEntrega(btn, settings) {
  const patientId = String(btn.dataset.patientId || '').trim();
  const guardiaId = String(btn.dataset.guardiaId || '').trim();
  if (!patientId && !guardiaId) return;

  btn.disabled = true;
  try {
    await tryRestoreOrphanPatientFromLan(patientId);
    await openEntregaForOrphan(patientId, guardiaId);
    selectOrphanPatientIfLocal(patientId);
  } finally {
    btn.disabled = false;
    await refreshGuardiaCensusFromDb(settings);
    syncOrphanEntregasStrip(settings);
  }
}

/** @param {string} patientId @returns {Promise<boolean>} */
async function purgeOrphanPatientOnHost(patientId) {
  const lan = await import('./features/lan-sync.mjs');
  const onLan =
    typeof lan.getActiveLiveSyncRoomId === 'function' && !!lan.getActiveLiveSyncRoomId();
  if (!onLan || typeof lan.purgeLanPatientFromHost !== 'function') {
    toast('Sin conexión ⇄; solo se liberará la entrega en esta Mac.', 'info');
    return false;
  }

  const purge = await lan.purgeLanPatientFromHost(patientId);
  if (purge?.ok) {
    if (!purge.hadHostRow) {
      toast('No había expediente en el anfitrión; se liberará solo la entrega.', 'info');
    }
  } else if (purge?.error === 'owned_by_other_client') {
    toast('El expediente pertenece a otro equipo LAN; solo se liberará la entrega local.', 'info');
  } else if (purge?.error === 'not_configured') {
    toast('Sin conexión ⇄ activa; solo se liberará la entrega local.', 'warn');
  } else {
    toast('No se pudo borrar del anfitrión; se liberará la entrega local.', 'warn');
  }

  if (typeof lan.pushClinicalOpsLanNow === 'function') {
    await lan.pushClinicalOpsLanNow();
  }
  return !!purge?.ok;
}

/** @param {string} patientId */
async function removeOrphanPatientLocally(patientId) {
  if (!patientInLocalCensus(patientId)) return;
  const lanMod = await import('./features/lan-sync.mjs');
  if (typeof lanMod.removePatientLocally === 'function') {
    lanMod.removePatientLocally(patientId);
  }
  saveState({ immediate: true });
}

/** @param {HTMLButtonElement} btn @param {Record<string, unknown>|null} settings */
async function deleteOrphanFromServer(btn, settings) {
  const patientId = String(btn.dataset.patientId || '').trim();
  const guardiaId = String(btn.dataset.guardiaId || '').trim();
  if (!patientId && !guardiaId) return;

  const ok = window.confirm(
    '¿Eliminar este paciente del anfitrión ⇄ y liberar la entrega?\n\n' +
      'Se borrará el expediente en la red local y dejará de asignarte el paciente. Esta acción no se puede deshacer.'
  );
  if (!ok) return;

  const api = dbApi();
  if (!api || typeof api.dbGuardiaResolve !== 'function') {
    toast('Base clínica no disponible.', 'error');
    return;
  }

  btn.disabled = true;
  let hostPurged = false;
  try {
    const res = await api.dbGuardiaResolve({ patientId, guardiaId });
    if (!res?.ok || !res.resolved) {
      toast(res?.error || 'No se liberó la entrega.', 'error');
      return;
    }

    hostPurged = await purgeOrphanPatientOnHost(patientId);
    await removeOrphanPatientLocally(patientId);

    toast(
      hostPurged ? 'Paciente eliminado del servidor y entrega liberada.' : 'Entrega liberada.',
      'success'
    );
    await refreshGuardiaCensusFromDb(settings);
    syncOrphanEntregasStrip(settings);
  } finally {
    btn.disabled = false;
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function syncOrphanEntregasStrip(settings) {
  renderOrphanEntregasStrip(clinicalSessionContext.orphanGuardias || [], { settings });
}
