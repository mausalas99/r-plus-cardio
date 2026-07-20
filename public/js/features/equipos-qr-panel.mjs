/**
 * R4 / program admin: QR lista de espera (Lumify / EKG / US).
 * Compact teaser in ⇄ dropdown; full panel in a wide modal (like Mi rotación).
 */
import { copyInternoQrImage, downloadInternoQrPng, drawInternoQrCanvas } from '../interno-qr-render.mjs';
import { copyToClipboardSafe } from './soap-estado.mjs';
import { showToast } from '../ui-toast.mjs';
import { canManageInternoQr } from '../clinical-privileges.mjs';
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import { closeModalAnimated } from '../ui-motion.mjs';
import {
  EQUIPOS_CLOUD_DEFAULT_URL,
  equiposCloudFetch,
  equiposCloudMobileUrl,
  getEquiposCloudConfig,
  setEquiposCloudConfig,
} from '../equipos-cloud-config.mjs';
import { renderEquiposBoardPanel } from './equipos-board.mjs';
import { cardionotasLoopbackBaseUrl } from '../http-port.mjs';

/** @type {{ hostBaseUrl?: string, userId?: string, showToast?: (msg: string, kind?: string) => void } | null} */
let panelOpts = null;
let modalChromeWired = false;

function dbApi() {
  return window.rplusDb || window.electronAPI || null;
}

function normalizeHostBase(hostBase) {
  const base = String(hostBase || '')
    .trim()
    .replace(/\/+$/, '');
  return base || cardionotasLoopbackBaseUrl();
}

function lanEquiposUrl(hostBase) {
  const host = normalizeHostBase(hostBase);
  return `${host}/equipos`;
}

function equiposListaBackdrop() {
  return document.getElementById('equipos-lista-backdrop');
}

function equiposListaPanelHost() {
  return document.getElementById('equipos-lista-panel-body');
}

function isEquiposListaPanelOpen() {
  const bd = equiposListaBackdrop();
  return !!(bd && bd.classList.contains('open'));
}

async function fetchAccessRow() {
  const cloud = getEquiposCloudConfig();
  if (cloud.enabled) {
    const res = await equiposCloudFetch('/admin/access');
    return res.row;
  }
  const api = dbApi();
  if (!api?.dbEquiposAccessGet) return null;
  const res = await api.dbEquiposAccessGet();
  return res?.row || null;
}

async function rotateAccessToken(userId) {
  const cloud = getEquiposCloudConfig();
  if (cloud.enabled) {
    await equiposCloudFetch('/admin/access/rotate', {
      method: 'POST',
      body: { rotatedBy: userId || 'admin' },
    });
    return;
  }
  const api = dbApi();
  await api.dbEquiposAccessRotate({ userId });
}

async function setAccessActive(userId, active) {
  const cloud = getEquiposCloudConfig();
  if (cloud.enabled) {
    await equiposCloudFetch('/admin/access/set-active', {
      method: 'POST',
      body: { active },
    });
    return;
  }
  const api = dbApi();
  await api.dbEquiposAccessSetActive({ userId, active });
}

function equiposUrlForToken(_token, hostBase) {
  const cloud = getEquiposCloudConfig();
  if (cloud.enabled) return equiposCloudMobileUrl();
  return lanEquiposUrl(hostBase);
}

function renderQueueBoardSection() {
  return (
    `<section class="equipos-queue-panel" aria-label="Estado de la cola">` +
    `<h4 class="equipos-queue-panel-title">Cola en vivo</h4>` +
    `<div id="equipos-queue-board-host" class="equipos-queue-board-host"></div>` +
    `</section>`
  );
}

async function refreshQueueBoard(body, programToken = '') {
  const boardHost = body.querySelector('#equipos-queue-board-host');
  if (boardHost) await renderEquiposBoardPanel(boardHost, { programToken });
}

function renderCloudSetupBlock() {
  const cfg = getEquiposCloudConfig();
  const badge = cfg.enabled
    ? '<span class="equipos-cloud-badge is-live">En línea</span>'
    : '<span class="equipos-cloud-badge is-pending">Sin guardar</span>';
  const workersDevWarn = cfg.url && /laboratoriazo-lic\.workers\.dev/i.test(cfg.url)
    ? '<p class="equipos-cloud-setup-warn">Esa URL usa el subdominio viejo. Usa la nueva: rmas-lista-de-espera.rmas-workersdev.workers.dev</p>'
    : '';
  return (
    `<section class="equipos-cloud-setup">` +
    `<div class="equipos-cloud-setup-head">` +
    `<h4 class="equipos-cloud-setup-title">Enlace público ${badge}</h4></div>` +
    `<p class="equipos-cloud-setup-hint">Cola <strong>R+ Lista de espera</strong> en Cloudflare. Sin anfitrión LAN.</p>` +
    workersDevWarn +
    `<div class="equipos-cloud-fields">` +
    `<div class="lan-connect-field"><label for="eq-cloud-url">URL</label>` +
    `<input id="eq-cloud-url" type="url" class="profile-input" data-eq-cloud-url value="${esc(cfg.url || EQUIPOS_CLOUD_DEFAULT_URL)}" placeholder="${esc(EQUIPOS_CLOUD_DEFAULT_URL)}" /></div>` +
    `<div class="lan-connect-field"><label for="eq-cloud-admin">Clave admin</label>` +
    `<input id="eq-cloud-admin" type="password" class="profile-input" data-eq-cloud-admin value="${esc(cfg.adminKey)}" autocomplete="off" placeholder="La misma que en wrangler secret" /></div>` +
    `<button type="button" class="btn-lan-secondary equipos-cloud-save" data-eq-cloud-save>Guardar</button>` +
    `</div></section>`
  );
}

function renderQrBlock({ url, active, cloudMode, showLanNotice, hasToken }) {
  const mode = cloudMode ? 'Cloud' : 'LAN';
  const status = active ? 'Activo' : 'Inactivo';
  if (!hasToken) {
    return (
      `<section class="equipos-qr-resident">` +
      `<p class="equipos-qr-meta">Enlace para residentes · <strong>${mode}</strong></p>` +
      `<p class="clinical-teams-empty">Aún no hay enlace. Guarda URL y clave admin, luego genera el enlace.</p>` +
      `<div class="equipos-qr-actions equipos-qr-actions--row">` +
      `<button type="button" class="btn-lan-primary" data-eq-rotate>Generar enlace</button>` +
      `<button type="button" class="btn-lan-secondary" data-eq-qr disabled>Copiar QR</button>` +
      `</div></section>`
    );
  }
  return (
    `<section class="equipos-qr-resident">` +
    (showLanNotice
      ? `<p class="equipos-qr-lan-notice">Modo LAN solo funciona en la red del hospital. Para enlace público, guarda la URL cloud arriba.</p>`
      : '') +
    `<p class="equipos-qr-meta">Enlace para residentes · <strong>${mode}</strong> · <strong>${status}</strong></p>` +
    `<div class="equipos-qr-resident-grid">` +
    `<div class="equipos-qr-preview-host" data-eq-qr-preview aria-hidden="true"></div>` +
    `<div class="equipos-qr-resident-side">` +
    `<p class="equipos-qr-url-box" tabindex="0" title="${esc(url)}">${esc(url)}</p>` +
    `<div class="equipos-qr-actions equipos-qr-actions--row">` +
    `<button type="button" class="btn-lan-secondary" data-eq-rotate>Regenerar</button>` +
    `<button type="button" class="btn-lan-primary" data-eq-qr>Copiar QR</button>` +
    `<button type="button" class="btn-lan-secondary" data-eq-qr-download>Descargar QR</button>` +
    `<button type="button" class="btn-lan-secondary" data-eq-copy>Copiar enlace</button>` +
    `<button type="button" class="btn-lan-secondary" data-eq-toggle>${active ? 'Desactivar' : 'Activar'}</button>` +
    `</div></div></div></section>`
  );
}

function renderCompactSummary({ cloudMode, active, hasToken, errorMsg }) {
  const mode = cloudMode ? 'Cloud' : 'LAN';
  const status = !hasToken ? 'Sin enlace' : active ? 'Activo' : 'Inactivo';
  const sub = errorMsg
    ? esc(errorMsg)
    : `${mode} · ${status} · Lumify / EKG / US`;
  return (
    `<div class="settings-card equipos-qr-compact-row">` +
    `<div class="settings-card__copy">` +
    `<p class="settings-card__title">R+ Lista de espera</p>` +
    `<p class="settings-card__desc">${sub}</p>` +
    `</div>` +
    `<div class="settings-card__action">` +
    `<button type="button" class="btn-settings-row equipos-qr-open-btn" data-eq-open-panel>Abrir</button>` +
    `</div></div>`
  );
}

/** @param {HTMLElement} host @param {string} url */

import { esc } from '../dom-escape.mjs';
function mountQrPreview(host, url) {
  if (!host || !url) return;
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'equipos-qr-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Código QR del enlace de lista de espera');
  try {
    drawInternoQrCanvas(canvas, url, { cellPx: 2, margin: 10 });
    host.appendChild(canvas);
    host.removeAttribute('aria-hidden');
  } catch {
    host.setAttribute('aria-hidden', 'true');
  }
}

function wireModalChromeOnce() {
  if (modalChromeWired) return;
  modalChromeWired = true;
  const bd = equiposListaBackdrop();
  if (!bd) return;

  document.getElementById('btn-equipos-lista-close')?.addEventListener('click', () => {
    closeEquiposListaPanel();
  });
  bd.addEventListener('click', (ev) => {
    if (ev.target === bd) closeEquiposListaPanel();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && isEquiposListaPanelOpen()) {
      ev.preventDefault();
      closeEquiposListaPanel();
    }
  });
}

export function closeEquiposListaPanel() {
  const bd = equiposListaBackdrop();
  if (!bd) return;
  closeModalAnimated(bd, () => {
    document.body.classList.remove('equipos-lista-modal-open');
  });
}

/**
 * @param {{ hostBaseUrl?: string, userId?: string, showToast?: (msg: string, kind?: string) => void }} [overrideOpts]
 */
export async function openEquiposListaPanel(overrideOpts = {}) {
  const opts = {
    hostBaseUrl: panelOpts?.hostBaseUrl,
    userId: panelOpts?.userId,
    ...overrideOpts,
  };
  if (!opts.hostBaseUrl) opts.hostBaseUrl = normalizeHostBase('');
  wireModalChromeOnce();

  const bd = equiposListaBackdrop();
  const body = equiposListaPanelHost();
  if (!bd || !body) return;

  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  document.body.classList.add('equipos-lista-modal-open');
  body.innerHTML = '<p class="clinical-teams-empty">Cargando…</p>';
  body.scrollTop = 0;

  try {
    const { closeConnectionDropdown } = await import('./lan/panel.mjs');
    closeConnectionDropdown();
  } catch {
    /* ⇄ panel optional */
  }

  await renderEquiposListaPanelInto(body, opts);
}

function readEquiposCloudFieldsFromDom(body) {
  return {
    url: body.querySelector('[data-eq-cloud-url]')?.value?.trim() || '',
    adminKey: body.querySelector('[data-eq-cloud-admin]')?.value?.trim() || '',
  };
}

function persistEquiposCloudFieldsFromDom(body, toast) {
  const { url, adminKey } = readEquiposCloudFieldsFromDom(body);
  if (!url || !adminKey) {
    toast('Indica URL y clave admin.', 'error');
    return false;
  }
  setEquiposCloudConfig({ url, adminKey });
  return true;
}

function mountEquiposListaBody(body, panelCtx, html, programToken, summary) {
  body.innerHTML = html;
  body.querySelector('[data-eq-cloud-save]')?.addEventListener('click', () => {
    if (!persistEquiposCloudFieldsFromDom(body, panelCtx.toast)) return;
    panelCtx.toast('Enlace cloud guardado.', 'success');
    void refreshEquiposListaPanel(body, panelCtx);
  });
  void refreshQueueBoard(body, programToken);
  if (typeof panelCtx.opts.onCompactChange === 'function') panelCtx.opts.onCompactChange(summary);
}

function wireEquiposListaQrActions(body, panelCtx, url, active, hasToken) {
  const toast = panelCtx.toast;
  const refresh = () => refreshEquiposListaPanel(body, panelCtx);
  if (hasToken) {
    mountQrPreview(body.querySelector('[data-eq-qr-preview]'), url);
  }
  body.querySelector('[data-eq-copy]')?.addEventListener('click', () => {
    if (!url) {
      toast('Genera el enlace primero.', 'error');
      return;
    }
    void copyToClipboardSafe(url).then((ok) => {
      toast(ok ? 'Enlace copiado.' : 'No se pudo copiar al portapapeles.', ok ? 'success' : 'error');
    });
  });
  body.querySelector('[data-eq-qr]')?.addEventListener('click', () => {
    if (!url) {
      toast('Genera el enlace primero.', 'error');
      return;
    }
    void copyInternoQrImage(url, (msg, kind) => toast(msg, kind));
  });
  body.querySelector('[data-eq-qr-download]')?.addEventListener('click', () => {
    if (!url) {
      toast('Genera el enlace primero.', 'error');
      return;
    }
    downloadInternoQrPng(url, 'qr-lista-espera.png');
    toast('QR descargado en alta resolución.', 'success');
  });
  body.querySelector('[data-eq-rotate]')?.addEventListener('click', async () => {
    try {
      if (!persistEquiposCloudFieldsFromDom(body, toast)) return;
      if (hasToken && !confirm('¿Regenerar enlace? El anterior dejará de funcionar.')) return;
      await rotateAccessToken(panelCtx.opts.userId || panelCtx.user.user_id);
      toast(hasToken ? 'Enlace regenerado.' : 'Enlace generado.', 'success');
      await refresh();
    } catch (e) {
      toast(e?.message || 'No se pudo generar el enlace.', 'error');
    }
  });
  body.querySelector('[data-eq-toggle]')?.addEventListener('click', async () => {
    try {
      if (!persistEquiposCloudFieldsFromDom(body, toast)) return;
      await setAccessActive(panelCtx.opts.userId || panelCtx.user.user_id, !active);
      toast(active ? 'Acceso desactivado.' : 'Acceso activado.', 'info');
      await refresh();
    } catch (e) {
      toast(e?.message || 'No se pudo cambiar el acceso.', 'error');
    }
  });
}

async function refreshEquiposListaPanel(body, panelCtx) {
  const cloudNow = getEquiposCloudConfig();
  const cloudBlock = renderCloudSetupBlock();
  const hostBase = panelCtx.hostBase;

  try {
    const row = await fetchAccessRow();
    if (!row) {
      const summary = { cloudMode: cloudNow.enabled, active: false, hasToken: false, errorMsg: '' };
      mountEquiposListaBody(
        body,
        panelCtx,
        cloudBlock +
          renderQueueBoardSection() +
          renderQrBlock({ url: '', active: false, cloudMode: cloudNow.enabled, showLanNotice: false, hasToken: false }),
        '',
        summary
      );
      wireEquiposListaQrActions(body, panelCtx, '', false, false);
      return;
    }
    const accessToken = String(row.access_token || '').trim();
    const hasToken = accessToken.length > 0;
    const url = hasToken ? equiposUrlForToken(accessToken, hostBase) : '';
    const active = row.is_active === 1;
    const summary = { cloudMode: cloudNow.enabled, active, hasToken, errorMsg: '' };
    mountEquiposListaBody(
      body,
      panelCtx,
      cloudBlock +
        renderQueueBoardSection() +
        renderQrBlock({
          url,
          active,
          cloudMode: cloudNow.enabled,
          showLanNotice: !cloudNow.enabled,
          hasToken,
        }),
      accessToken,
      summary
    );
    wireEquiposListaQrActions(body, panelCtx, url, active, hasToken);
  } catch (e) {
    const msg = String(e.message || 'No se pudo conectar.');
    const needsAdmin = /administrador|admin_required/i.test(msg);
    const summary = { cloudMode: cloudNow.enabled, active: false, hasToken: false, errorMsg: msg };
    mountEquiposListaBody(
      body,
      panelCtx,
      cloudBlock +
        renderQueueBoardSection() +
        `<p class="clinical-teams-empty">${esc(msg)}</p>` +
        (needsAdmin
          ? `<p class="equipos-qr-lan-notice">Guarda URL y clave admin arriba, luego pulsa <strong>Generar enlace</strong>.</p>`
          : '') +
        renderQrBlock({ url: '', active: false, cloudMode: cloudNow.enabled, showLanNotice: false, hasToken: false }),
      '',
      summary
    );
    wireEquiposListaQrActions(body, panelCtx, '', false, false);
  }
}

/**
 * @param {HTMLElement} body
 * @param {{ hostBaseUrl?: string, userId?: string, showToast?: (msg: string, kind?: string) => void, onCompactChange?: (summary: object) => void }} opts
 */
async function renderEquiposListaPanelInto(body, opts) {
  const panelCtx = {
    user: clinicalSessionContext.user || {},
    hostBase: normalizeHostBase(opts.hostBaseUrl),
    toast: opts.showToast || showToast,
    opts,
  };
  await refreshEquiposListaPanel(body, panelCtx);
}

/**
 * @param {HTMLElement} root
 * @param {{ hostBaseUrl?: string, userId?: string, showToast?: (msg: string, kind?: string) => void }} opts
 */
export async function appendEquiposQrPanel(root, opts = {}) {
  const user = clinicalSessionContext.user || {};
  if (!canManageInternoQr(user)) return;

  const cloud = getEquiposCloudConfig();
  const api = dbApi();
  if (!cloud.enabled && !api?.dbEquiposAccessGet) return;

  panelOpts = {
    hostBaseUrl: normalizeHostBase(opts.hostBaseUrl),
    userId: opts.userId || user.user_id,
  };
  wireModalChromeOnce();

  const host = document.createElement('div');
  host.className = 'equipos-qr-compact-host';
  host.innerHTML = '<p class="settings-card__desc" style="padding:10px 12px;margin:0">Cargando…</p>';
  root.appendChild(host);

  const compactHost = host;

  function paintCompact(summary) {
    if (!compactHost) return;
    compactHost.innerHTML = renderCompactSummary(summary);
    compactHost.querySelector('[data-eq-open-panel]')?.addEventListener('click', () => {
      void openEquiposListaPanel();
    });
  }

  const renderOpts = {
    ...panelOpts,
    onCompactChange: paintCompact,
  };

  try {
    const cloudNow = getEquiposCloudConfig();
    const row = await fetchAccessRow();
    const accessToken = row ? String(row.access_token || '').trim() : '';
    const hasToken = accessToken.length > 0;
    const active = row?.is_active === 1;
    paintCompact({
      cloudMode: cloudNow.enabled,
      active,
      hasToken,
      errorMsg: '',
    });
  } catch (e) {
    paintCompact({
      cloudMode: cloud.enabled,
      active: false,
      hasToken: false,
      errorMsg: String(e.message || ''),
    });
  }

  if (isEquiposListaPanelOpen()) {
    const body = equiposListaPanelHost();
    if (body) await renderEquiposListaPanelInto(body, renderOpts);
  }
}
