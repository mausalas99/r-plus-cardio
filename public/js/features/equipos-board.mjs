/**
 * Desktop equipos queue board — lives in ⇄ LAN dropdown (R+ Lista de espera card).
 */
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import { canManageInternoQr } from '../clinical-privileges.mjs';
import { DEVICE_LABELS, STATUS_LABELS } from '../../equipos/equipos-rotaciones.mjs';
import { promoteSelfToEquiposHost } from './equipos-host-failover.mjs';
import { equiposCloudFetch, getEquiposCloudConfig } from '../equipos-cloud-config.mjs';
import { loadEquiposHistoryPanel } from './equipos-history.mjs';
import { showToast } from '../ui-toast.mjs';

import { esc } from '../dom-escape.mjs';
function dbApi() {
  return window.rplusDb || window.electronAPI || null;
}

/** @param {object} dev */
function renderDeviceRow(dev, isAdmin) {
  const label = DEVICE_LABELS[dev.device_type] || dev.device_type;
  const status = STATUS_LABELS[dev.status] || dev.status;
  const purgeBtn = isAdmin
    ? `<button type="button" class="btn-lan-secondary" data-purge="${esc(dev.device_type)}" style="font-size:11px">Purgar cola</button>`
    : '';
  return (
    `<div class="equipos-desktop-row">` +
    `<strong>${esc(label)}</strong> — ${esc(status)}` +
    `<div class="equipos-desktop-row-meta">` +
    (dev.holder_name ? `En uso: ${esc(dev.holder_name)} (${esc(dev.holder_rotation)})` : 'Disponible') +
    ` · Cola: ${dev.waitlist?.length || 0}` +
    `</div>${purgeBtn}</div>`
  );
}

async function fetchBoard(opts = {}) {
  const cloud = getEquiposCloudConfig();
  if (cloud.enabled) {
    const programToken = String(opts.programToken || '').trim();
    if (!cloud.adminKey && !programToken) {
      const err = new Error('Guarda URL y clave admin, luego pulsa Guardar (o Generar enlace y QR).');
      err.code = 'admin_required';
      throw err;
    }
    return equiposCloudFetch('/board', {
      useAdminKey: !!cloud.adminKey,
      programToken,
    });
  }
  const api = dbApi();
  if (!api?.dbEquiposBoard) return null;
  const res = await api.dbEquiposBoard();
  return res.board || res;
}

async function purgeQueue(deviceType) {
  const cloud = getEquiposCloudConfig();
  const user = clinicalSessionContext.user || {};
  if (cloud.enabled) {
    await equiposCloudFetch('/admin/purge-queue', {
      method: 'POST',
      body: {
        deviceType,
        adminUserId: user.user_id,
        adminName: user.clinical_name || user.username || 'Admin',
      },
    });
    return;
  }
  const api = dbApi();
  await api.dbEquiposPurgeQueue({ userId: user.user_id, deviceType });
}

function renderLanHostMissing(host) {
  host.innerHTML =
    '<p class="clinical-teams-empty">Conecta al host ⇄ para ver equipos.</p>' +
    '<button type="button" class="btn-lan-secondary" id="btn-equipos-promote">Actuar como anfitrión temporal</button>';
  host.querySelector('#btn-equipos-promote')?.addEventListener('click', () => {
    const user = clinicalSessionContext.user || {};
    void promoteSelfToEquiposHost({
      showToast,
      userId: user.user_id,
      name: user.clinical_name,
      rank: user.rank,
    }).then(() => renderEquiposBoardPanel(host));
  });
}

/** @param {boolean} cloud @param {string} [detail] */
function renderLoadFailure(host, cloud, detail) {
  const msg =
    detail ||
    (cloud
      ? 'No se pudo conectar al servicio cloud. Revisa URL y clave admin en ⇄ → R+ Lista de espera.'
      : 'No se pudo cargar equipos.');
  host.innerHTML = `<p class="clinical-teams-empty">${esc(msg)}</p>`;
}

function buildEquiposAlertsHtml(alerts) {
  return (alerts || [])
    .map(
      (a) =>
        `<div class="equipos-alert-banner" style="margin-bottom:8px;font-size:12px">` +
        `${a.kind === 'malfunction' ? 'Falla' : 'Material faltante'} — ${esc(DEVICE_LABELS[a.device_type])}</div>`
    )
    .join('');
}

function buildEquiposBoardHtml(board, cloud, isAdmin) {
  const mobileHref = cloud.enabled ? cloud.url : '/equipos';
  const storageHint = cloud.enabled
    ? '<p class="equipos-board-storage-hint">Datos en Cloudflare (D1). No están en rplus-clinical.db local.</p>'
    : '<p class="equipos-board-storage-hint">Datos en rplus-clinical.db (este Mac si es anfitrión).</p>';
  return (
    `<div class="equipos-desktop-head">` +
    `<span class="equipos-board-mode">${cloud.enabled ? 'Cloud' : 'LAN'}</span>` +
    `<a href="${esc(mobileHref)}" target="_blank" rel="noopener" class="btn-lan-secondary equipos-board-open-mobile">Abrir móvil</a>` +
    `</div>${storageHint}${buildEquiposAlertsHtml(board.alerts)}` +
    `<div id="equipos-board-live">${(board.devices || []).map((d) => renderDeviceRow(d, isAdmin)).join('')}</div>` +
    `<div id="equipos-history-host" class="equipos-history-host" hidden></div>` +
    (isAdmin
      ? `<div class="equipos-board-admin-actions">` +
        `<button type="button" class="btn-lan-secondary" id="btn-equipos-history">Historial de uso</button>` +
        `<button type="button" class="btn-lan-secondary" id="btn-equipos-purge-all">Purgar todo</button>` +
        `</div>`
      : '')
  );
}

function wireEquiposBoardActions(host) {
  host.querySelectorAll('[data-purge]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Liberar este dispositivo y vaciar la cola?')) return;
      await purgeQueue(btn.getAttribute('data-purge'));
      showToast('Cola purgada.', 'success');
      await renderEquiposBoardPanel(host);
    });
  });
  host.querySelector('#btn-equipos-purge-all')?.addEventListener('click', async () => {
    if (!confirm('¿Purgar cola de los tres dispositivos?')) return;
    await purgeQueue('all');
    showToast('Colas purgadas.', 'success');
    await renderEquiposBoardPanel(host);
  });
  host.querySelector('#btn-equipos-history')?.addEventListener('click', () => {
    const historyHost = host.querySelector('#equipos-history-host');
    void loadEquiposHistoryPanel(historyHost, showToast);
  });
}

/** @param {HTMLElement | null} [hostEl] @param {{ programToken?: string }} [opts] */
export async function renderEquiposBoardPanel(hostEl, opts = {}) {
  const host = hostEl || document.getElementById('equipos-queue-board-host');
  if (!host) return;

  const cloud = getEquiposCloudConfig();
  const api = dbApi();

  if (cloud.enabled) {
    host.innerHTML = '<p class="clinical-teams-empty">Cargando cola de equipos…</p>';
  } else if (!api?.dbEquiposBoard) {
    renderLanHostMissing(host);
    return;
  }

  try {
    const board = await fetchBoard(opts);
    if (!board) {
      renderLoadFailure(host, cloud.enabled);
      return;
    }
    const isAdmin = canManageInternoQr(clinicalSessionContext.user);
    host.innerHTML = buildEquiposBoardHtml(board, cloud, isAdmin);
    wireEquiposBoardActions(host);
  } catch (e) {
    renderLoadFailure(host, cloud.enabled, e?.message);
  }
}
