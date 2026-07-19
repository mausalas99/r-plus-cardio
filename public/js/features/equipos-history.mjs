/**
 * Equipos custody history (sessions) for R4/Admin in Modo Guardia.
 */
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import { DEVICE_LABELS } from '../../equipos/equipos-rotaciones.mjs';
import { equiposCloudFetch, getEquiposCloudConfig } from '../equipos-cloud-config.mjs';

import { esc } from '../dom-escape.mjs';
const CLOSED_LABELS = {
  return: 'Devolución',
  admin_purge: 'Purgado',
  admin_force_return: 'Forzado',
};

function dbApi() {
  return window.rplusDb || window.electronAPI || null;
}

/** @param {string} [iso] */
function fmtWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** @param {number|null|undefined} sec */
function fmtDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const n = Math.max(0, Math.floor(sec));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return '< 1 min';
}

/** @param {object} row */
function sessionStatus(row) {
  if (!row.returned_at) return 'En curso';
  return CLOSED_LABELS[row.closed_reason] || 'Cerrado';
}

async function fetchEquiposReports() {
  const cloud = getEquiposCloudConfig();
  if (cloud.enabled) {
    const res = await equiposCloudFetch('/reports');
    return { sessions: res.sessions || [], reports: res.reports || [] };
  }
  const api = dbApi();
  const user = clinicalSessionContext.user || {};
  if (!api?.dbEquiposReports) throw new Error('Base de equipos no disponible.');
  const res = await api.dbEquiposReports({ userId: user.user_id });
  return { sessions: res.sessions || [], reports: res.reports || [] };
}

/** @param {object[]} sessions */
function renderSessionsTable(sessions) {
  if (!sessions.length) {
    return '<p class="equipos-history-empty">Sin registros de uso todavía.</p>';
  }
  const rows = sessions
    .map(
      (s) =>
        `<tr>` +
        `<td>${esc(DEVICE_LABELS[s.device_type] || s.device_type)}</td>` +
        `<td>${esc(s.holder_name)}</td>` +
        `<td>${esc(s.holder_rotation)}</td>` +
        `<td>${esc(fmtWhen(s.checked_out_at))}</td>` +
        `<td>${esc(fmtWhen(s.returned_at))}</td>` +
        `<td>${esc(fmtDuration(s.duration_seconds))}</td>` +
        `<td>${esc(sessionStatus(s))}</td>` +
        `</tr>`
    )
    .join('');
  return (
    `<div class="equipos-history-scroll">` +
    `<table class="equipos-history-table">` +
    `<thead><tr>` +
    `<th>Equipo</th><th>Residente</th><th>Rotación</th>` +
    `<th>Tomó</th><th>Devolvió</th><th>Duración</th><th>Estado</th>` +
    `</tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

/**
 * @param {HTMLElement} host
 * @param {(msg: string, kind?: string) => void} [showToast]
 */
export async function loadEquiposHistoryPanel(host, showToast) {
  if (!host) return;
  host.hidden = false;
  host.innerHTML = '<p class="equipos-history-loading">Cargando historial…</p>';
  try {
    const { sessions } = await fetchEquiposReports();
    host.innerHTML =
      `<div class="equipos-history-head">` +
      `<h3 class="equipos-history-title">Historial de uso</h3>` +
      `<button type="button" class="btn-lan-secondary equipos-history-close" data-eq-history-close>Cerrar</button>` +
      `</div>` +
      renderSessionsTable(sessions);
    host.querySelector('[data-eq-history-close]')?.addEventListener('click', () => {
      host.hidden = true;
      host.innerHTML = '';
    });
  } catch (e) {
    host.innerHTML = `<p class="equipos-history-empty">${esc(e.message || 'No se pudo cargar el historial.')}</p>`;
    showToast?.(e.message || 'Error al cargar historial.', 'error');
  }
}
