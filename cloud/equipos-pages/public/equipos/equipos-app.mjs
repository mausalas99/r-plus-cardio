import { isCloudEquiposMode } from '../lib/equipos/equipos-cloud-mode.mjs';
import { resolveEquiposApiBase } from './host-discovery.mjs';
import { equiposFetch, resizeImageFile } from './equipos-api.mjs';
import { EQUIPOS_ROTACIONES, DEVICE_LABELS, STATUS_LABELS } from './equipos-rotaciones.mjs';
import { initEquiposAdmin, exitEquiposAdmin } from './equipos-admin.mjs';
import {
  registerEquiposServiceWorker,
  enableQueuePush,
  disableQueuePush,
  pushSupported,
  pushSetupHint,
  pushActivationNeeded,
  refreshPushSubscribeState,
  persistPushSyncFromBoard,
  isIosDevice,
  isAndroidDevice,
  isStandalonePwa,
} from './equipos-push.mjs';
import {
  shouldShowIosInstallBanner,
  dismissIosInstallBanner,
  renderIosInstallBannerHtml,
} from './equipos-ios-install.mjs';

import { esc } from '../js/dom-escape.mjs';
import {
  TOKEN_KEY,
  loadAccessToken,
  persistAccessToken,
  readTokenFromCookie,
  readTokenFromUrl,
  clearAccessToken,
  fetchCloudInviteToken,
} from './equipos-token.mjs';
const NAME_KEY = 'rpc-equipos-name';
const ROT_KEY = 'rpc-equipos-rotation';
const POLL_MS = 30000;
const CLOUD_STAMP_MS = 2500;
const LAN_STAMP_MS = 4000;

let apiBase = '';
let token = '';
let board = null;
let ws = null;
let pollTimer = null;
let stampTimer = null;
let lastBoardStamp = '';
let modalEl = null;
/** @type {Set<string>} device types with queue panel expanded */
const openQueueDevices = new Set();

const root = document.getElementById('equipos-app');

function persistEquiposHomeUrl() {
  try {
    sessionStorage.setItem('equipos-home-url', location.pathname + location.search);
  } catch (_e) {
    void _e;
  }
}

function migrateIdentityStorage() {
  for (const key of [NAME_KEY, ROT_KEY, TOKEN_KEY]) {
    if (!localStorage.getItem(key) && sessionStorage.getItem(key)) {
      localStorage.setItem(key, sessionStorage.getItem(key));
    }
  }
  if (!localStorage.getItem(TOKEN_KEY)) {
    const fromCookie = readTokenFromCookie();
    if (fromCookie) persistAccessToken(fromCookie);
  }
}

function identity() {
  return {
    reporterName: localStorage.getItem(NAME_KEY) || '',
    rotation: localStorage.getItem(ROT_KEY) || '',
  };
}

function persistIdentity(name, rotation) {
  if (name) localStorage.setItem(NAME_KEY, name);
  if (rotation) localStorage.setItem(ROT_KEY, rotation);
}

function captureIdentityFromDom() {
  const nameEl = document.getElementById('eq-name');
  const rotEl = document.getElementById('eq-rot');
  if (!nameEl && !rotEl) return;
  persistIdentity(nameEl?.value?.trim() || '', rotEl?.value || '');
}

function wireIdentityPersistence() {
  const nameEl = document.getElementById('eq-name');
  const rotEl = document.getElementById('eq-rot');
  const onName = () => {
    const name = nameEl?.value?.trim() || '';
    if (name) localStorage.setItem(NAME_KEY, name);
  };
  const onRot = () => {
    const rotation = rotEl?.value || '';
    if (rotation) localStorage.setItem(ROT_KEY, rotation);
  };
  nameEl?.addEventListener('input', onName);
  nameEl?.addEventListener('change', onName);
  rotEl?.addEventListener('change', onRot);
}

function showToast(msg) {
  let el = document.querySelector('.equipos-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'equipos-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

async function resolveToken() {
  const fromUrl = readTokenFromUrl();
  if (fromUrl) {
    persistAccessToken(fromUrl);
    return fromUrl;
  }
  const origin = typeof window !== 'undefined' ? window.location : null;
  if (!origin) return loadAccessToken();
  const base = `${origin.protocol}//${origin.host}`;
  if (isCloudEquiposMode()) {
    const invited = await fetchCloudInviteToken(base);
    if (invited) return invited;
    return '';
  }
  return loadAccessToken();
}

async function recoverCloudAccessToken() {
  clearAccessToken();
  if (typeof history !== 'undefined' && typeof URL !== 'undefined') {
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('t')) {
        url.searchParams.delete('t');
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (_e) {
      void _e;
    }
  }
  const base = apiBase || `${location.protocol}//${location.host}`;
  return fetchCloudInviteToken(base);
}

function renderMissingTokenScreen() {
  const copy =
    '<p>La lista de espera no está disponible. Pide al R4 que active el enlace.</p>';
  if (isCloudEquiposMode()) {
    root.innerHTML = '<div class="equipos-error-screen">' + copy + '</div>';
    return;
  }
  const pwaHint = isStandalonePwa()
    ? '<p class="equipos-error-sub">Abre el enlace del QR en Safari, espera a que cargue la cola, y <strong>después</strong> agrégalo a Inicio. Si ya tienes el icono, bórralo y repite.</p>'
    : '';
  root.innerHTML =
    '<div class="equipos-error-screen">' +
    copy +
    pwaHint +
    '</div>';
}

function closeModal() {
  if (modalEl) modalEl.remove();
  modalEl = null;
}

function openModal(title, bodyHtml, onSubmit) {
  closeModal();
  modalEl = document.createElement('div');
  modalEl.className = 'equipos-modal-backdrop';
  modalEl.innerHTML =
    `<div class="equipos-modal" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3>
      ${bodyHtml}
      <div class="equipos-actions" style="margin-top:14px">
        <button type="button" class="equipos-btn secondary" data-act="cancel">Cancelar</button>
        <button type="button" class="equipos-btn" data-act="ok">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(modalEl);
  modalEl.querySelector('[data-act="cancel"]').onclick = closeModal;
  modalEl.querySelector('[data-act="ok"]').onclick = () => void onSubmit(modalEl);
}

function wireLumifySkipCharge(modal) {
  const skip = modal.querySelector('#eq-skip-charge');
  const input = modal.querySelector('#eq-pickup-charge');
  if (!skip || !input) return;
  const sync = () => {
    input.disabled = skip.checked;
    if (skip.checked) input.value = '';
  };
  skip.addEventListener('change', sync);
  sync();
}

function parseOptionalChargePct(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 100) return Number.NaN;
  return Math.round(n);
}

function parseRequiredChargePct(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return Number.NaN;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 100) return Number.NaN;
  return Math.round(n);
}

async function readPhotoInput(input) {
  const file = input?.files?.[0];
  if (!file) return null;
  return resizeImageFile(file);
}

function renderLoadError(kind = 'unavailable') {
  if (isCloudEquiposMode()) {
    const copy =
      kind === 'auth'
        ? 'La lista de espera no está activa o el enlace expiró. Pide ayuda al R4.'
        : 'No se pudo conectar a la cola de equipos. Revisa tu conexión e inténtalo de nuevo.';
    root.innerHTML =
      `<div class="equipos-error-screen">` +
      `<h2>${kind === 'auth' ? 'Acceso inválido' : 'Servicio no disponible'}</h2>` +
      `<p>${copy}</p></div>`;
    return;
  }
  root.innerHTML =
    `<div class="equipos-error-screen">` +
    `<h2>Sin anfitrión de equipos</h2>` +
    `<p>No se encontró el servidor en la red. Abre R+ en tu Mac y actúa como anfitrión temporal, o conéctate a la sala ⇄.</p>` +
    `</div>`;
}

function renderIdentityForm() {
  const id = identity();
  const opts = EQUIPOS_ROTACIONES.map(
    (r) => `<option value="${esc(r)}" ${id.rotation === r ? 'selected' : ''}>${esc(r)}</option>`
  ).join('');
  return (
    `<div class="equipos-identity">
      <p class="equipos-identity-title">Identificación</p>
      <div><label for="eq-name">Tu nombre</label>
      <input id="eq-name" type="text" value="${esc(id.reporterName)}" autocomplete="name" /></div>
      <div><label for="eq-rot">Rotación</label>
      <select id="eq-rot"><option value="">—</option>${opts}</select></div>
    </div>`
  );
}

function saveIdentityFromDom() {
  const name = document.getElementById('eq-name')?.value?.trim() || '';
  const rotation = document.getElementById('eq-rot')?.value || '';
  if (name.length < 2) {
    showToast('Escribe tu nombre.');
    return false;
  }
  if (!rotation) {
    showToast('Elige tu rotación.');
    return false;
  }
  persistIdentity(name, rotation);
  return true;
}

function pushNeedsActivation() {
  return pushActivationNeeded();
}

function toastPushResult(pushResult, joinedQueue = false) {
  if (pushResult.ok) {
    showToast(joinedQueue ? 'Te uniste a la cola. Notificaciones activadas.' : 'Notificaciones activadas.');
    return;
  }
  if (joinedQueue) {
    if (pushResult.reason === 'unsupported' && isIosDevice() && !isStandalonePwa()) {
      showToast('Te uniste a la cola. Agrégalo a Inicio para recibir avisos.');
      return;
    }
    if (pushResult.reason === 'unconfigured') {
      showToast('Te uniste a la cola. Avisos no configurados en el servidor.');
      return;
    }
    showToast('Te uniste a la cola. Pulsa «Activar avisos» para recibir notificación.');
    return;
  }
  if (pushResult.reason === 'denied') {
    if (isAndroidDevice()) {
      showToast('Permite notificaciones: Ajustes → Apps → Chrome → Notificaciones.');
    } else {
      showToast('Activa notificaciones en Ajustes del teléfono para recibir avisos.');
    }
    return;
  }
  if (pushResult.reason === 'unconfigured') {
    showToast('Avisos no configurados en el servidor. Avísale al R4.');
    return;
  }
  if (pushResult.reason === 'unsupported' && isIosDevice() && !isStandalonePwa()) {
    showToast('En iPhone, agrega R+ Cola a Inicio para recibir avisos.');
    return;
  }
  if (pushResult.reason === 'no_sw') {
    showToast('No se pudo registrar avisos. Cierra y vuelve a abrir la cola.');
  }
}

function renderPushActivationButton(deviceType) {
  if (!pushNeedsActivation()) return '';
  if (isIosDevice() && !isStandalonePwa()) {
    return `<button type="button" class="equipos-btn secondary" data-act="ios-install-scroll">Agregar a Inicio</button>`;
  }
  if (!pushSupported()) return '';
  return `<button type="button" class="equipos-btn push-activate" data-act="enable-push" data-dev="${deviceType}">Activar avisos</button>`;
}

async function activateQueuePushForDevice(deviceType) {
  const id = identity();
  return enableQueuePush({
    apiBase,
    token,
    deviceType,
    reporterName: id.reporterName,
    rotation: id.rotation,
  });
}

function queueIndexForDevice(dev) {
  const me = identity();
  return (dev.waitlist || []).findIndex(
    (w) => w.reporter_name === me.reporterName && w.rotation === me.rotation
  );
}

function isDeviceHolder(dev) {
  const me = identity();
  return dev.holder_name === me.reporterName && dev.holder_rotation === me.rotation;
}

function deviceRow(deviceType) {
  return board?.devices?.find((d) => d.device_type === deviceType) || null;
}

function checkoutBypassMessage(dev) {
  const wl = dev?.waitlist || [];
  if (!wl.length) return '';
  const myIndex = queueIndexForDevice(dev);
  if (myIndex === 0) return '';
  if (myIndex < 0) {
    return '<p>No estás en la cola. Solo el siguiente equipo debería tomarlo.</p>' +
      '<p>Se notificará a quienes esperan. ¿Tomarlo de todos modos?</p>';
  }
  return `<p>No eres el siguiente en la cola (posición ${myIndex + 1}).</p>` +
    '<p>Se notificará a quienes esperan. ¿Tomarlo de todos modos?</p>';
}

function renderWaitlistPanel(dev) {
  const wl = dev.waitlist || [];
  const showPanel =
    dev.status === 'in_use' || (dev.status === 'available' && wl.length > 0);
  if (!showPanel) return '';
  const myIndex = queueIndexForDevice(dev);
  const isHolder = isDeviceHolder(dev);
  if (myIndex >= 0) openQueueDevices.add(dev.device_type);
  const isOpen = openQueueDevices.has(dev.device_type);

  const summaryLabel =
    wl.length === 0
      ? 'Cola · vacía'
      : `Cola · ${wl.length} ${wl.length === 1 ? 'persona' : 'personas'}`;

  const listItems = wl.length
    ? wl
        .map(
          (w, i) =>
            `<li class="equipos-queue-item${i === 0 ? ' is-next' : ''}${myIndex === i ? ' is-you' : ''}">
              <span class="equipos-queue-pos">${i + 1}</span>
              <span class="equipos-queue-name">${esc(w.reporter_name)}</span>
              <span class="equipos-queue-rot">${esc(w.rotation)}</span>
            </li>`
        )
        .join('')
    : '<li class="equipos-queue-empty">Nadie en cola todavía.</li>';

  let queueActions = '';
  if (myIndex >= 0) {
    const canSkip = myIndex < wl.length - 1;
    const pushHint = pushNeedsActivation()
      ? `<p class="equipos-push-hint">${esc(pushSetupHint())}</p>` +
        (isIosDevice() && !isStandalonePwa()
          ? `<button type="button" class="equipos-btn secondary" data-act="ios-install-scroll">Agregar a Inicio</button>`
          : pushSupported()
            ? `<button type="button" class="equipos-btn secondary" data-act="enable-push" data-dev="${dev.device_type}">Activar avisos</button>`
            : '')
      : '';
    queueActions = `<p class="equipos-queue-you">Tu posición: ${myIndex + 1}</p>
      ${pushHint}
      <div class="equipos-queue-btn-row">
        ${canSkip ? `<button type="button" class="equipos-btn secondary" data-act="skip" data-dev="${dev.device_type}">Ceder turno</button>` : ''}
        <button type="button" class="equipos-btn secondary" data-act="leave" data-dev="${dev.device_type}">Salir de cola</button>
      </div>`;
  } else if (!isHolder) {
    queueActions = `<button type="button" class="equipos-btn secondary" data-act="join" data-dev="${dev.device_type}">Entrar en cola</button>`;
  }

  return (
    `<details class="equipos-queue" data-device="${dev.device_type}"${isOpen ? ' open' : ''}>
      <summary>${summaryLabel}</summary>
      <ol class="equipos-queue-list">${listItems}</ol>
      ${queueActions ? `<div class="equipos-queue-actions">${queueActions}</div>` : ''}
    </details>`
  );
}

function deviceCard(dev) {
  const label = DEVICE_LABELS[dev.device_type] || dev.device_type;
  const status = STATUS_LABELS[dev.status] || dev.status;
  const stale =
    dev.staleHours >= 4 ? '<span class="equipos-chip stale">Cola estancada</span>' : '';
  const holder = dev.holder_name
    ? `En uso: <strong>${esc(dev.holder_name)}</strong> (${esc(dev.holder_rotation)})`
    : 'Nadie lo tiene';
  const prev =
    dev.previous_holder_name
      ? `<br>Anterior: ${esc(dev.previous_holder_name)} (${esc(dev.previous_holder_rotation)})`
      : '';

  let actions = '';
  if (dev.status === 'available') {
    const myIndex = queueIndexForDevice(dev);
    if (myIndex < 0) {
      actions += `<button type="button" class="equipos-btn" data-act="join" data-dev="${dev.device_type}">Entrar en cola</button>`;
      actions += `<button type="button" class="equipos-btn secondary" data-act="checkout" data-dev="${dev.device_type}">Tomar</button>`;
    } else if (myIndex === 0) {
      actions += `<span class="equipos-queue-badge">En cola · #1</span>`;
      actions += renderPushActivationButton(dev.device_type);
      actions += `<button type="button" class="equipos-btn" data-act="checkout" data-dev="${dev.device_type}">Tomar</button>`;
    } else {
      actions += `<span class="equipos-queue-badge">En cola · #${myIndex + 1}</span>`;
      actions += renderPushActivationButton(dev.device_type);
      actions += `<button type="button" class="equipos-btn secondary" data-act="checkout" data-dev="${dev.device_type}">Tomar</button>`;
    }
  } else if (dev.status === 'in_use') {
    if (isDeviceHolder(dev)) {
      actions += `<button type="button" class="equipos-btn" data-act="return" data-dev="${dev.device_type}">Entregar</button>`;
    } else {
      const myIndex = queueIndexForDevice(dev);
      if (myIndex >= 0) {
        actions += `<span class="equipos-queue-badge">En cola · #${myIndex + 1}</span>`;
        actions += renderPushActivationButton(dev.device_type);
      } else {
        actions += `<button type="button" class="equipos-btn" data-act="join" data-dev="${dev.device_type}">Entrar en cola</button>`;
      }
    }
  }
  actions += `<button type="button" class="equipos-btn warn secondary" data-act="alert" data-dev="${dev.device_type}">Reportar problema</button>`;

  return (
    `<article class="equipos-card" data-device="${dev.device_type}">
      <div class="equipos-card-head">
        <h2>${esc(label)}</h2>
        <span><span class="equipos-chip ${dev.status}">${esc(status)}</span>${stale}</span>
      </div>
      <div class="equipos-meta">${holder}${prev}</div>
      ${renderWaitlistPanel(dev)}
      <div class="equipos-actions">${actions}</div>
    </article>`
  );
}

function renderBoard() {
  if (!board) return;
  captureIdentityFromDom();
  const leaseBadge =
    !isCloudEquiposMode() && board.lease?.mode === 'temporary'
      ? `<p class="equipos-lease-badge">Anfitrión temporal${board.lease.rank ? ` (${esc(board.lease.rank)})` : ''}</p>`
      : '';
  const alerts = (board.alerts || [])
    .map(
      (a) =>
        `<div class="equipos-alert-banner">
          <strong>${a.kind === 'malfunction' ? 'Falla' : 'Material faltante'}</strong> — ${esc(DEVICE_LABELS[a.device_type])}
          ${a.message ? `: ${esc(a.message)}` : ''}
          <div style="margin-top:8px"><button type="button" class="equipos-btn secondary" data-act="ack" data-id="${esc(a.id)}">Entendido</button></div>
        </div>`
    )
    .join('');

  root.innerHTML =
    (shouldShowIosInstallBanner() ? renderIosInstallBannerHtml() : '') +
    (leaseBadge ? `<div class="equipos-lease-strip">${leaseBadge}</div>` : '') +
    renderIdentityForm() +
    alerts +
    (board.devices || []).map(deviceCard).join('');

  root.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => void handleAction(btn));
  });

  root.querySelectorAll('details.equipos-queue').forEach((el) => {
    el.addEventListener('toggle', () => {
      const devType = el.getAttribute('data-device');
      if (!devType) return;
      if (el.open) {
        root.querySelectorAll('details.equipos-queue').forEach((other) => {
          if (other === el) return;
          other.open = false;
          const otherType = other.getAttribute('data-device');
          if (otherType) openQueueDevices.delete(otherType);
        });
        openQueueDevices.add(devType);
      } else {
        openQueueDevices.delete(devType);
      }
    });
  });

  wireIdentityPersistence();
}

async function refreshBoard() {
  board = await equiposFetch(apiBase, token, '/board');
  renderBoard();
}

async function handleAction(btn) {
  if (!saveIdentityFromDom()) return;
  const act = btn.getAttribute('data-act');
  const dev = btn.getAttribute('data-dev');
  const id = identity();

  if (act === 'ack') {
    await equiposFetch(apiBase, token, `/alert/${btn.getAttribute('data-id')}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id),
    });
    showToast('Reporte atendido.');
    await refreshBoard();
    return;
  }

  if (act === 'join') {
    openQueueDevices.add(dev);
    try {
      await equiposFetch(apiBase, token, '/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...id, deviceType: dev }),
      });
    } catch (e) {
      openQueueDevices.delete(dev);
      showToast(e.message || 'No se pudo entrar en la cola.');
      return;
    }
    if (pushSupported()) {
      await registerEquiposServiceWorker();
    }
    const pushResult = pushSupported()
      ? await activateQueuePushForDevice(dev)
      : { ok: false, reason: 'unsupported' };
    toastPushResult(pushResult, true);
    await refreshPushSubscribeState();
    await refreshBoard();
    return;
  }

  if (act === 'enable-push') {
    const pushResult = await activateQueuePushForDevice(dev);
    toastPushResult(pushResult, false);
    await refreshPushSubscribeState();
    await refreshBoard();
    return;
  }

  if (act === 'ios-install-scroll') {
    document.getElementById('equipos-ios-install')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Sigue los pasos para agregar R+ Cola a Inicio.');
    return;
  }

  if (act === 'ios-install-dismiss') {
    dismissIosInstallBanner();
    renderBoard();
    return;
  }

  if (act === 'ios-install-help') {
    try {
      sessionStorage.setItem('equipos-ayuda-return', location.pathname + location.search);
    } catch (_e) {
      void _e;
    }
    const helpHref = location.pathname.startsWith('/equipos') ? 'ayuda.html' : 'equipos/ayuda.html';
    location.href = helpHref;
    return;
  }

  if (act === 'leave') {
    await disableQueuePush({
      apiBase,
      token,
      deviceType: dev,
      reporterName: id.reporterName,
      rotation: id.rotation,
    });
    await equiposFetch(apiBase, token, '/waitlist/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...id, deviceType: dev }),
    });
    showToast('Saliste de la cola.');
    await refreshBoard();
    return;
  }

  if (act === 'skip') {
    await equiposFetch(apiBase, token, '/waitlist/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...id, deviceType: dev }),
    });
    showToast('Cediste tu turno. Sigues en la cola.');
    await refreshBoard();
    return;
  }

  if (act === 'checkout') {
    const devRow = deviceRow(dev);
    const bypassMsg = devRow ? checkoutBypassMessage(devRow) : '';
    const startCheckout = (forceQueueBypass) => {
      const needsPhoto = dev === 'lumify' || dev === 'ekg';
      const lumifyExtra =
        dev === 'lumify'
          ? `<div><label for="eq-pickup-charge">Carga de tablet % (opcional)</label>
             <input type="number" id="eq-pickup-charge" min="0" max="100" inputmode="numeric" placeholder="Ej. 85" />
             <label><input type="checkbox" id="eq-skip-charge" /> Omitir carga</label></div>`
          : '';
      openModal(
        'Tomar dispositivo',
        `${needsPhoto ? '<div><label>Foto al recoger</label><input type="file" accept="image/*" capture="environment" id="eq-photo" /></div>' : ''}${lumifyExtra}`,
        async (modal) => {
          try {
            let pickupChargePct = null;
            if (dev === 'lumify' && !modal.querySelector('#eq-skip-charge')?.checked) {
              pickupChargePct = parseOptionalChargePct(modal.querySelector('#eq-pickup-charge')?.value);
              if (Number.isNaN(pickupChargePct)) {
                showToast('Carga inválida (0–100).');
                return;
              }
            }
            const photoBase64 = needsPhoto
              ? await readPhotoInput(modal.querySelector('#eq-photo'))
              : null;
            if (needsPhoto && !photoBase64) {
              showToast('Se requiere foto.');
              return;
            }
            await equiposFetch(apiBase, token, '/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...id,
                deviceType: dev,
                pickupChargePct,
                photoBase64,
                forceQueueBypass,
              }),
            });
            closeModal();
            showToast('Dispositivo tomado.');
            await refreshBoard();
          } catch (e) {
            showToast(e.message || 'Error al tomar.');
          }
        }
      );
      wireLumifySkipCharge(modalEl);
    };

    if (bypassMsg) {
      openModal('Fuera de turno', bypassMsg, () => {
        closeModal();
        startCheckout(true);
      });
      return;
    }

    startCheckout(false);
    return;
  }

  if (act === 'return') {
    const needsPhoto = dev === 'lumify' || dev === 'ekg';
    const lumifyExtra =
      dev === 'lumify'
        ? `<div><label for="eq-return-charge">Carga de tablet % (obligatoria)</label>
           <input type="number" id="eq-return-charge" min="0" max="100" inputmode="numeric" required placeholder="0–100" />
           <label><input type="checkbox" id="eq-gel-empty" /> Gel vacío</label></div>`
        : '';
    openModal(
      'Entregar dispositivo',
      `${needsPhoto ? '<div><label>Foto al entregar</label><input type="file" accept="image/*" capture="environment" id="eq-photo" /></div>' : ''}${lumifyExtra}`,
      async (modal) => {
        try {
          const photoBase64 = needsPhoto
            ? await readPhotoInput(modal.querySelector('#eq-photo'))
            : null;
          if (needsPhoto && !photoBase64) {
            showToast('Se requiere foto.');
            return;
          }
          const body = { ...id, deviceType: dev, photoBase64 };
          if (dev === 'lumify') {
            const chargePct = parseRequiredChargePct(modal.querySelector('#eq-return-charge')?.value);
            if (Number.isNaN(chargePct)) {
              showToast('Indica la carga de tablet (0–100).');
              return;
            }
            body.chargePct = chargePct;
            body.gelEmpty = !!modal.querySelector('#eq-gel-empty')?.checked;
          }
          await equiposFetch(apiBase, token, '/return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          closeModal();
          showToast('Dispositivo entregado.');
          await refreshBoard();
        } catch (e) {
          showToast(e.message || 'Error al entregar.');
        }
      }
    );
    return;
  }

  if (act === 'alert') {
    openModal(
      'Reportar problema',
      `<div><label>Tipo</label>
        <select id="eq-alert-kind"><option value="missing_material">Material faltante</option>
        <option value="malfunction">Falla del dispositivo</option></select></div>
        <div><label>Detalle (opcional)</label><input type="text" id="eq-alert-msg" /></div>
        <div><label>Foto del problema</label><input type="file" accept="image/*" capture="environment" id="eq-alert-photo" /></div>`,
      async (modal) => {
        try {
          const photoBase64 = await readPhotoInput(modal.querySelector('#eq-alert-photo'));
          if (!photoBase64) {
            showToast('Se requiere foto al reportar.');
            return;
          }
          await equiposFetch(apiBase, token, '/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...id,
              deviceType: dev,
              kind: modal.querySelector('#eq-alert-kind')?.value,
              message: modal.querySelector('#eq-alert-msg')?.value,
              photoBase64,
            }),
          });
          closeModal();
          showToast('Reporte enviado al equipo.');
          await refreshBoard();
        } catch (e) {
          showToast(e.message || 'Error.');
        }
      }
    );
  }
}

function connectWs() {
  if (!apiBase || !token || isCloudEquiposMode()) return;
  const wsUrl =
    apiBase.replace(/^http/, 'ws') + `/api/equipos/v1/ws`;
  ws = new WebSocket(wsUrl);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'board-changed' || msg.type === 'equipos:host-handoff') {
        void refreshBoard();
      }
    } catch (_e) {
      void _e;
    }
  };
  ws.onclose = () => setTimeout(connectWs, 4000);
}

async function pollBoardStamp() {
  if (!apiBase || !token) return;
  try {
    const data = await equiposFetch(apiBase, token, '/board/stamp');
    const stamp = String(data.stamp || '');
    if (!lastBoardStamp) {
      lastBoardStamp = stamp;
      return;
    }
    if (stamp !== lastBoardStamp) {
      lastBoardStamp = stamp;
      await refreshBoard();
    }
  } catch (_e) {
    void _e;
  }
}

function startBoardStampPoll() {
  if (stampTimer) clearInterval(stampTimer);
  const ms = isCloudEquiposMode() ? CLOUD_STAMP_MS : LAN_STAMP_MS;
  stampTimer = setInterval(() => void pollBoardStamp().catch(() => {}), ms);
}

async function syncExistingQueuePushSubscriptions() {
  if (!board || !pushSupported() || Notification.permission !== 'granted') return;
  const me = identity();
  if (!me.reporterName || !me.rotation) return;
  const queues = [];
  for (const dev of board.devices || []) {
    const wl = dev.waitlist || [];
    const inQueue = wl.some(
      (w) => w.reporter_name === me.reporterName && w.rotation === me.rotation
    );
    if (!inQueue) continue;
    queues.push({
      deviceType: dev.device_type,
      reporterName: me.reporterName,
      rotation: me.rotation,
    });
    try {
      await enableQueuePush({
        apiBase,
        token,
        deviceType: dev.device_type,
        reporterName: me.reporterName,
        rotation: me.rotation,
        requestPermission: false,
      });
    } catch (_e) {
      void _e;
    }
  }
  await persistPushSyncFromBoard({ apiBase, token, queues });
}

function scheduleBackgroundPushResync() {
  if (!pushSupported()) return;
  void syncExistingQueuePushSubscriptions()
    .then(() => refreshPushSubscribeState())
    .catch(() => {});
}

async function init() {
  migrateIdentityStorage();
  persistEquiposHomeUrl();

  document.getElementById('equipos-inicio')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    root?.focus({ preventScroll: true });
  });
  document.getElementById('equipos-ayuda')?.addEventListener('click', () => {
    try {
      sessionStorage.setItem('equipos-ayuda-return', location.pathname + location.search);
    } catch (_e) {
      void _e;
    }
    const helpHref = location.pathname.startsWith('/equipos') ? 'ayuda.html' : 'equipos/ayuda.html';
    location.href = helpHref;
  });
  window.addEventListener('pagehide', captureIdentityFromDom);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') scheduleBackgroundPushResync();
  });

  token = await resolveToken();
  if (!token) {
    renderMissingTokenScreen();
    return;
  }
  root.innerHTML = isCloudEquiposMode()
    ? '<div class="equipos-empty"><p>Cargando cola de equipos…</p></div>'
    : '<div class="equipos-empty"><p>Buscando host de equipos…</p></div>';
  apiBase = await resolveEquiposApiBase();
  if (!apiBase) {
    renderLoadError();
    return;
  }
  try {
    await refreshBoard();
  } catch (e) {
    const code = e?.code || '';
    if (isCloudEquiposMode() && (code === 'invalid_token' || code === 'auth_required')) {
      const fresh = await recoverCloudAccessToken();
      if (fresh) {
        token = fresh;
        try {
          await refreshBoard();
        } catch (retryErr) {
          renderLoadError('auth');
          return;
        }
      } else {
        renderLoadError('auth');
        return;
      }
    } else if (code === 'invalid_token' || code === 'auth_required') {
      renderLoadError('auth');
      return;
    } else {
      root.innerHTML = `<div class="equipos-error-screen"><p>${esc(e.message || 'Error al cargar.')}</p></div>`;
      return;
    }
  }

  try {
    persistAccessToken(token);
    try {
      const stampData = await equiposFetch(apiBase, token, '/board/stamp');
      lastBoardStamp = String(stampData.stamp || '');
    } catch (_e) {
      void _e;
    }
    startBoardStampPoll();
    initEquiposAdmin({
      apiBase,
      token,
      root,
      cloudOnly: isCloudEquiposMode(),
      showToast,
      markBoardDirty: () => {
        lastBoardStamp = '';
      },
      resumeBoard: () => {
        exitEquiposAdmin();
        void refreshBoard();
      },
    });
    connectWs();
    if (isCloudEquiposMode()) {
      pollTimer = setInterval(() => void refreshBoard().catch(() => {}), POLL_MS);
    }
    if (pushSupported()) {
      void registerEquiposServiceWorker()
        .then(() => refreshPushSubscribeState())
        .then(() => syncExistingQueuePushSubscriptions())
        .then(() => renderBoard());
    }
  } catch (e) {
    root.innerHTML = `<div class="equipos-error-screen"><p>${esc(e.message || 'Error al cargar.')}</p></div>`;
  }
}

void init();
