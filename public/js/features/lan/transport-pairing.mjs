/**
 * LAN pairing tickets, migration notice, and invite exchange.
 */
import { appendMobileSharerParamsToJoinUrl } from '../../mobile-sharer-sync.mjs';
import {
  recordWardHostUrl,
  mergeWardHostRegistry,
} from '../../lan-ward-host-registry.mjs';
import { getLanClientId } from './runtime.mjs';
import { runtime, esc } from './transport-deps.mjs';
import { lanFetchAuthed, resolveHostBearerToken, getLanTeamCodeFromConfig, isLanSessionConfiguredForRest, ensureLanClientTeamCodeAligned } from './transport-session.mjs';
import { fixMobileLanHostUrl, verifyTeamHashFromUrl, persistGuestBearerFromExchange } from './transport-mobile.mjs';
import {
  buildShareJoinUrl,
  resolveLanShareBaseUrl,
  resolveLanHostUrlForShare,
  resolveLanTeamCodeForShare,
} from './transport-host-url.mjs';

const LAN_MIGRATION_NOTICE_KEY = 'rplus.lan.migrationNoticeShown';
let _lastLanPairing = null;

export async function mintLanPairingTicket() {
  await ensureLanClientTeamCodeAligned();
  var bearer = await resolveHostBearerToken();
  if (!bearer) {
    var err = new Error('no_host_bearer');
    err.code = 'no_host_bearer';
    throw err;
  }
  var resp = await lanFetchAuthed('/api/lan/v1/auth/tickets', { method: 'POST' });
  if (!resp.ok) {
    var errHttp = new Error('ticket_mint_failed');
    errHttp.status = resp.status;
    throw errHttp;
  }
  var body = await resp.json();
  var ticketId = String(body.ticketId || '');
  var shareHost = await resolveLanShareBaseUrl();
  var teamCode = await resolveLanTeamCodeForShare();
  _lastLanPairing = {
    ticketId: ticketId,
    pin: String(body.pin || ''),
    joinUrl:
      shareHost && ticketId
        ? await buildShareJoinUrl(shareHost, ticketId, teamCode)
        : String(body.joinUrl || ''),
    expiresAt: body.expiresAt,
  };
  return _lastLanPairing;
}
function showLanMigrationNoticeModal() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lan-migration-notice-backdrop')) return;
  var backdrop = document.createElement('div');
  backdrop.id = 'lan-migration-notice-backdrop';
  backdrop.className = 'modal-backdrop open';
  backdrop.style.zIndex = '10050';
  backdrop.innerHTML =
    '<div class="lab-conflict-modal" style="max-width:420px;">' +
    '<h3>Seguridad de red del equipo</h3>' +
    '<p>El código LAN débil (<code>1234</code> u otro antiguo) se sustituyó por un token seguro en esta Mac anfitriona. Tus pacientes y salas LAN se conservaron.</p>' +
    '<p style="font-size:12px;color:var(--text-muted);">Quienes se unan deben usar un <strong>enlace o PIN nuevo</strong> que generes aquí (⇄). Los enlaces viejos con <code>?code=</code> ya no funcionan.</p>' +
    '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
    '<button type="button" id="lan-migration-notice-ok" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">Entendido</button>' +
    '</div></div>';
  document.body.appendChild(backdrop);
  var ok = backdrop.querySelector('#lan-migration-notice-ok');
  if (ok) {
    ok.onclick = function () {
      backdrop.remove();
    };
  }
  backdrop.addEventListener('click', function (ev) {
    if (ev.target === backdrop) backdrop.remove();
  });
}

export async function maybeShowLanMigrationNotice() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (sessionStorage.getItem(LAN_MIGRATION_NOTICE_KEY)) return;
  } catch (_e) { void _e; }
  if (!isLanSessionConfiguredForRest()) return;
  var resp;
  try {
    resp = await lanFetchAuthed('/api/lan/v1/host-status');
  } catch {
    return;
  }
  if (!resp || !resp.ok) return;
  var data;
  try {
    data = await resp.json();
  } catch {
    return;
  }
  if (!data || !data.requiresMigrationNotice) return;
  try {
    sessionStorage.setItem(LAN_MIGRATION_NOTICE_KEY, '1');
  } catch (_e) { void _e; }
  showLanMigrationNoticeModal();
}

export async function exchangeLanJoinFromInvite(hostUrl, ticketId, roomId, joinUrl) {
  var base = fixMobileLanHostUrl(hostUrl);
  var tid = String(ticketId || '').trim();
  if (!base || !tid) {
    runtime().showToast('Falta la dirección del servidor o el ticket de invitación.', 'error');
    return;
  }
  var verifyUrl =
    String(joinUrl || '').trim() ||
    `${base}/join/${encodeURIComponent(tid)}`;
  var hashOk = await verifyTeamHashFromUrl(verifyUrl, getLanTeamCodeFromConfig());
  if (!hashOk) {
    runtime().showToast('Este enlace es de otra sala o servicio. Verifica con el anfitrión.', 'warn');
    return;
  }
  var ctrl = new AbortController();
  var timer = setTimeout(function () {
    ctrl.abort();
  }, 12000);
  var res;
  try {
    res = await fetch(base + '/api/lan/v1/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: tid, clientId: getLanClientId() }),
      signal: ctrl.signal,
    });
  } catch {
    runtime().showToast('Error de red al unirse. Revisa Wi‑Fi y que R+ siga abierto en el anfitrión.', 'error');
    return;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    runtime().showToast(
      'Este enlace o PIN ya no es válido. Pide al anfitrión un nuevo enlace o PIN.',
      'error'
    );
    return;
  }
  var data;
  try {
    data = await res.json();
  } catch {
    runtime().showToast('Respuesta inválida del servidor.', 'error');
    return;
  }
  await persistGuestBearerFromExchange(data);
  const joinedUrl = String(data.hostUrl || base);
  const { configureLanFromMobileJoin } = await import('./transport-mobile.mjs');
  configureLanFromMobileJoin(joinedUrl, data.token, roomId);
  recordWardHostUrl(joinedUrl, { source: 'client' });
  if (data.wardHostHints) mergeWardHostRegistry(data.wardHostHints);
}

export function formatLanTicketExpiryLabel(expiresAt) {
  var raw = String(expiresAt || '').trim();
  if (!raw) return '';
  var d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function lanTicketExpirySoon(expiresAt) {
  var raw = String(expiresAt || '').trim();
  if (!raw) return false;
  var d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() - Date.now() < 60000;
}
export async function ensureLanPairingForShare(opts) {
  opts = opts || {};
  var hostUrl = await resolveLanHostUrlForShare();
  if (!hostUrl) {
    var errUrl = new Error('no_host_url');
    errUrl.code = 'no_host_url';
    throw errUrl;
  }
  if (opts.forceNew || !_lastLanPairing || !_lastLanPairing.ticketId) {
    await mintLanPairingTicket();
  }
  if (!_lastLanPairing || !_lastLanPairing.ticketId) {
    var errTicket = new Error('no_ticket');
    errTicket.code = 'no_ticket';
    throw errTicket;
  }
  return { hostUrl: hostUrl, pairing: _lastLanPairing };
}

export function getLastLanPairing() {
  return _lastLanPairing;
}

/**
 * @param {HTMLElement|null} root
 * @param {{ boxId?: string, mobileHints?: boolean, activeRoomId?: string, displayUrl?: string, permanent?: boolean }} [opts]
 */
function resolvePairingLeadCopy(opts) {
  if (opts.permanent) {
    return 'Enlace permanente para Safari (favoritos). Incluye tu identidad; no caduca mientras el código del equipo no cambie. No lo compartas fuera del turno.';
  }
  if (opts.mobileHints) return 'Enlace móvil (incluye tu identidad). Un solo uso por ticket:';
  return 'Enlace de sala (sin tu identidad). Un solo uso por ticket:';
}

function buildPairingExpiryLine(pairing, opts) {
  if (opts.permanent || !pairing) return '';
  var expiryLabel = formatLanTicketExpiryLabel(pairing.expiresAt);
  if (!expiryLabel) return '';
  var expirySoon = lanTicketExpirySoon(pairing.expiresAt);
  return (
    '<p class="lan-pairing-expiry' +
    (expirySoon ? ' lan-pairing-expiry--soon' : '') +
    '" style="margin:8px 0 0;font-size:12px;">Válido hasta <strong>' +
    esc(expiryLabel) +
    '</strong></p>'
  );
}

function buildPairingPinLine(pairing, opts) {
  if (opts.permanent || !pairing) return '';
  return '<div><strong>PIN:</strong> <code>' + esc(pairing.pin) + '</code></div>';
}

export function updateLanPairingDisplay(root, opts) {
  opts = opts || {};
  var boxId = String(opts.boxId || 'lan-pairing-display-sala').trim();
  if (!root) root = document.getElementById('lan-connection-panel-root');
  if (!root) return;
  var box = root.querySelector('#' + boxId);
  if (!box) return;
  var displayUrl = String(opts.displayUrl || '').trim();
  var pairing = _lastLanPairing;
  if (!displayUrl) {
    if (!pairing || !pairing.ticketId) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    displayUrl = pairing.joinUrl || '';
    if (opts.mobileHints && displayUrl) {
      displayUrl = appendMobileSharerParamsToJoinUrl(displayUrl, opts.activeRoomId);
    }
  }
  box.hidden = false;
  var joinLine = displayUrl
    ? '<div><strong>Enlace:</strong> <code style="word-break:break-all;">' + esc(displayUrl) + '</code></div>'
    : '';
  var lead = resolvePairingLeadCopy(opts);
  box.innerHTML =
    '<p style="margin:0 0 6px;font-size:12px;color:var(--text-muted);">' + esc(lead) + '</p>' +
    buildPairingPinLine(pairing, opts) +
    joinLine +
    buildPairingExpiryLine(pairing, opts);
}

/**
 * @param {{ mobileHints?: boolean, boxId?: string, activeRoomId?: string, toastMsg?: string }} [opts]
 */
export async function mintLanPairingFromUi(opts) {
  opts = opts || {};
  try {
    await mintLanPairingTicket();
    var root = document.getElementById('lan-connection-panel-root');
    updateLanPairingDisplay(root, {
      boxId: opts.boxId || (opts.mobileHints ? 'lan-pairing-display-mobile' : 'lan-pairing-display-sala'),
      mobileHints: !!opts.mobileHints,
      activeRoomId: opts.activeRoomId,
    });
    runtime().showToast(
      opts.toastMsg ||
        (opts.mobileHints
          ? 'Enlace móvil generado. Cópialo abajo o usa «Copiar enlace móvil».'
          : 'Enlace de sala generado. Cópialo abajo o usa «Copiar enlace de sala».'),
      'success'
    );
  } catch (e) {
    if (e && e.code === 'no_host_bearer') {
      runtime().showToast(
        'No hay token seguro del servidor en esta Mac. Reinicia R+ como anfitrión o revisa lan-team-code.txt.',
        'error'
      );
      return;
    }
    if (e && e.status === 401) {
      runtime().showToast('No autorizado para generar invitación. Revisa el token del anfitrión.', 'error');
      return;
    }
    runtime().showToast('No se pudo generar enlace / PIN. Intenta de nuevo.', 'error');
  }
}
