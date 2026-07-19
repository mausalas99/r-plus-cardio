/**
 * LAN panel sync diagnostics + preflight UX — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { copyToClipboardSafe } from '../soap-estado.mjs';
import { outboxSize } from '../../live-sync-outbox.mjs';
import { getHostBundleBases } from '../../host-bundle-bases.mjs';
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { getPinnedHostUrl } from '../../lan-host-pin.mjs';
import {
  getLanSyncDiagnostics,
  formatDiagnosticsReport,
} from '../../lan-sync-diagnostics.mjs';
import { listLivePeerHostUrls } from '../../lan-surrogate-host.mjs';
import {
  isHostOnCurrentSubnets,
  resolveLocalLanSubnetPrefixes,
} from '../../lan-host-subnet-discovery.mjs';
import { findByFingerprint, getPinnedFingerprint, listHosts } from '../../lan-host-registry.mjs';
import { summarizeWardHostRegistry } from '../../lan-ward-host-registry.mjs';
import { canLocalMacBeLanHost } from '../../lan-host-rank-policy.mjs';
import { lanNetworkProfile } from '../../lan-network-profile.mjs';
import { getRoomSyncPhase } from '../../lan-sync-state.mjs';
import { isLanElectronDesktop, isLanRemoteJoinMode } from './transport.mjs';
import { flushLiveSyncOutbox } from './push.mjs';
import { getLanClientId } from './runtime.mjs';
import { recoverMonitoreoFromLanCache } from './vitals-recovery.mjs';

export const LAN_SYNC_DIAG_OPEN_KEY = 'rpc-lan-sync-diagnostics-open';

/** @typedef {{
 *   runtime: () => object,
 *   renderLanPanel: (opts?: object) => void,
 *   esc: (s: string) => string,
 *   getConnectionManager: () => object,
 *   lanHostUrl: () => string,
 *   getActiveLiveSyncRoomId: () => string,
 *   getLanClient: () => object,
 *   getLastPing: () => { at: number|null, status: number, rttMs: number },
 *   isLanConnectionDropdownOpen: () => boolean,
 *   captureConnectionDropdownScrollTop: () => number,
 *   restoreConnectionDropdownScrollTop: (n: number) => void,
 * }} PanelDiagnosticsDeps */

const SPLIT_SERVER_HINT_HTML =
  'Si el equipo no aparece en el directorio pero <strong>hostUrl</strong> difiere entre las Macs, hay <strong>dos servidores</strong> en la misma sala. Una Mac debe ser anfitrión y la otra conectarse con el enlace de invitación (⇄). Desactiva «Fijar anfitrión» si apunta a tu propia IP.';

/** @param {boolean} ok */
function preflightDot(ok) {
  return (
    '<span class="lan-hub-status-dot ' +
    (ok ? 'lan-hub-status-dot--pass' : 'lan-hub-status-dot--fail') +
    '" aria-hidden="true"></span>'
  );
}

/** @param {PanelDiagnosticsDeps} deps @param {boolean} ok @param {string} label @param {string} title */
function preflightItem(deps, ok, label, title) {
  return (
    '<span class="lan-preflight-item" title="' +
    deps.esc(title) +
    '">' +
    preflightDot(ok) +
    '<span>' +
    deps.esc(label) +
    '</span></span>'
  );
}

/** @param {PanelDiagnosticsDeps} deps @param {HTMLElement|null} root @param {object} preflight */
function renderLanPreflightRow(deps, root, preflight) {
  if (!root) return;
  var p = preflight || {};
  var row = root.querySelector('.lan-preflight-row');
  if (!row) {
    row = document.createElement('div');
    row.className = 'lan-preflight-row';
    row.addEventListener('click', function (e) {
      if (!e.shiftKey) return;
      var fp = getPinnedFingerprint();
      var rec = fp ? findByFingerprint(fp) : null;
      void copyToClipboardSafe(JSON.stringify(rec, null, 2)).then(function (ok) {
        if (ok) deps.runtime().showToast('Diagnóstico copiado', 'info');
      });
    });
    var anchor = root.querySelector('.lan-connection-hero') || root.querySelector('.lan-hub-status-card');
    if (anchor) root.insertBefore(row, anchor);
    else if (root.firstChild) root.insertBefore(row, root.firstChild);
    else root.appendChild(row);
  }

  if (p.phase === 'live') {
    // Single status dot lives in .lan-hub-status-line — avoid a second green indicator here.
    row.hidden = true;
    row.innerHTML = '';
    return;
  }

  row.hidden = false;
  row.innerHTML = [
    preflightItem(deps, p.rttMs > 0, p.rttMs ? p.rttMs + ' ms' : 'sin ping', 'Latencia al anfitrión'),
    preflightItem(deps, p.bearerValid, 'token', 'Bearer válido'),
    preflightItem(deps, p.subnetMatch, 'red', 'Mismo subnet'),
    preflightItem(
      deps,
      p.dbUnlocked !== false,
      p.dbUnlocked === false ? 'BD bloqueada' : 'BD',
      'Estado de la BD del anfitrión'
    ),
    preflightItem(deps, canLocalMacBeLanHost(), 'anfitrión', 'Este Mac puede ser anfitrión'),
  ].join('');

  if (p.transport && p.transport !== 'ws') {
    row.innerHTML +=
      '<span class="lan-preflight-transport">' + deps.esc(String(p.transport).toUpperCase()) + '</span>';
  }
}

/** @param {HTMLElement|null} statusEl @param {object} diag */
function updateLanOutboxBadge(statusEl, diag) {
  if (!statusEl || !diag) return;
  if ((diag.phase === 'offline' || diag.phase === 'queued') && Number(diag.outboxCount || 0) > 0) {
    var badge = statusEl.querySelector('.lan-outbox-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'lan-outbox-badge';
      badge.style.cssText =
        'margin-left:6px;font-size:11px;background:#f59e0b;color:#fff;padding:1px 5px;border-radius:10px;';
      statusEl.appendChild(badge);
    }
    var n = Number(diag.outboxCount || 0);
    badge.textContent = n + ' pendiente' + (n !== 1 ? 's' : '');
  } else {
    var existing = statusEl.querySelector('.lan-outbox-badge');
    if (existing) existing.remove();
  }
}

/** @param {string} roomId */
async function readOutboxCount(roomId) {
  if (!roomId) return 0;
  try {
    return await outboxSize(roomId);
  } catch {
    return 0;
  }
}

function readTeamCodeAligned() {
  try {
    var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
    var code = String(cfg.teamCode || '').trim();
    return !!(String(cfg.hostUrl || '').trim() && code.length >= 32);
  } catch {
    return false;
  }
}

function readProfileRtt() {
  try {
    return Number(lanNetworkProfile.getLastRttMs()) || 0;
  } catch {
    return 0;
  }
}

/** @param {string} clientId */
function readPeerHosts(clientId) {
  return typeof listLivePeerHostUrls === 'function' ? listLivePeerHostUrls(clientId) : [];
}

/** @param {PanelDiagnosticsDeps} deps */
async function buildLanSyncDiagnosticsDeps(deps) {
  var roomId = String(deps.getActiveLiveSyncRoomId() || '').trim();
  var bases = roomId ? getHostBundleBases(roomId) : { revision: 0 };
  var outCount = await readOutboxCount(roomId);
  var clientId = typeof getLanClientId === 'function' ? getLanClientId() : '';
  var peerHosts = readPeerHosts(clientId);
  var lanClient = deps.getLanClient();
  var lastPing = deps.getLastPing();
  return {
    hostUrl: deps.lanHostUrl(),
    pingAt: lastPing.at,
    pingStatus: lastPing.status,
    wsSync: !!lanClient.connected,
    wsLive: !!lanClient.liveConnected,
    liveRoomId: String(lanClient.liveRoomId || ''),
    roomId: roomId,
    phase: getRoomSyncPhase(roomId),
    bundleRevision: Number(bases.revision || 0),
    outboxCount: outCount,
    pinnedHost: getPinnedHostUrl(),
    teamCodeAligned: readTeamCodeAligned(),
    peerHostCount: peerHosts.length,
    networkProfile: lanNetworkProfile.getNetworkProfile(),
    transport: deps.getConnectionManager().getTransport(),
    rttMs: lastPing.rttMs || readProfileRtt() || 0,
    registryHostCount: listHosts().length,
    wardHostRegistry: summarizeWardHostRegistry(),
    role: isLanRemoteJoinMode() ? 'client' : 'host',
  };
}

/** @param {PanelDiagnosticsDeps} panelDeps @param {object} diagDeps @param {object} diag */
async function buildLanPreflightFromDeps(panelDeps, diagDeps, diag) {
  var pinnedFp = getPinnedFingerprint();
  var hostRecord = pinnedFp ? findByFingerprint(pinnedFp) : null;
  var hostUrl = String(diagDeps.hostUrl || '').trim();
  var subnetMatch = false;
  if (hostUrl) {
    try {
      var prefixes = await resolveLocalLanSubnetPrefixes(hostUrl);
      subnetMatch = isHostOnCurrentSubnets(hostUrl, prefixes);
    } catch (_e) { void _e; }
  }
  return {
    phase: diag.phase,
    rttMs: hostRecord ? hostRecord.rttMs : panelDeps.getLastPing().rttMs || 0,
    bearerValid: !!diagDeps.teamCodeAligned,
    subnetMatch: subnetMatch,
    dbUnlocked: hostRecord ? hostRecord.dbUnlocked : null,
    transport: panelDeps.getConnectionManager().getTransport(),
  };
}

/** @param {PanelDiagnosticsDeps} deps @param {HTMLElement|null} root */
async function renderLanPreflightUx(deps, root) {
  if (!root) return null;
  var diagDeps = await buildLanSyncDiagnosticsDeps(deps);
  var diag = getLanSyncDiagnostics(diagDeps);
  var preflight = await buildLanPreflightFromDeps(deps, diagDeps, diag);
  renderLanPreflightRow(deps, root, preflight);
  var statusEl = root.querySelector('.lan-hub-status-line');
  if (statusEl) updateLanOutboxBadge(statusEl, diag);
  return diag;
}

/** @param {object} diag */
function shouldShowSplitServerHint(diag) {
  return (
    diag.phase === 'live' &&
    diag.wsLive &&
    Number(diag.peerHostCount || 0) === 0 &&
    isLanElectronDesktop() &&
    !isLanRemoteJoinMode()
  );
}

/** @param {HTMLElement} panel @param {string} report @param {object} diag */
function updateLanSyncDiagnosticsSection(panel, report, diag) {
  var pre = panel.querySelector('.lan-sync-diagnostics-pre');
  if (pre) pre.textContent = report;
  var splitHint = panel.querySelector('.lan-sync-diagnostics-split-hint');
  var showSplit = shouldShowSplitServerHint(diag);
  if (showSplit && !splitHint) {
    var hint = document.createElement('p');
    hint.className = 'lan-connect-card-hint lan-sync-diagnostics-split-hint';
    hint.style.marginTop = '8px';
    hint.innerHTML = SPLIT_SERVER_HINT_HTML;
    var insertPre = panel.querySelector('.lan-sync-diagnostics-reportPre');
    if (insertPre) panel.insertBefore(hint, insertPre);
    else panel.appendChild(hint);
  } else if (!showSplit && splitHint) {
    splitHint.remove();
  }
}

function createDiagnosticsSecondaryButton(label, marginTop) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-lan-secondary';
  btn.style.width = '100%';
  if (marginTop) btn.style.marginTop = marginTop;
  btn.textContent = label;
  return btn;
}

/** @param {PanelDiagnosticsDeps} panelDeps */
function resolveActiveRoomId(panelDeps) {
  return (
    String(panelDeps.getActiveLiveSyncRoomId() || '').trim() ||
    String((getRoomMembership() && getRoomMembership().roomId) || '').trim()
  );
}

/** @param {PanelDiagnosticsDeps} panelDeps @param {object} diagDeps @param {HTMLElement} diagBody */
function appendDiagnosticsCopyButton(panelDeps, diagDeps, diagBody) {
  var copyBtn = createDiagnosticsSecondaryButton('Copiar informe');
  copyBtn.onclick = function () {
    var copyReport = formatDiagnosticsReport(getLanSyncDiagnostics(diagDeps));
    void copyToClipboardSafe(copyReport).then(function (ok) {
      panelDeps.runtime().showToast(
        ok ? 'Informe copiado (códigos redactados).' : 'No se pudo copiar el informe.',
        ok ? 'success' : 'error'
      );
    });
  };
  diagBody.appendChild(copyBtn);
}

/** @param {PanelDiagnosticsDeps} panelDeps @param {HTMLElement} diagBody */
function appendRetryOutboxButton(panelDeps, diagBody) {
  var retryBtn = createDiagnosticsSecondaryButton('Reintentar cola de sincronización', '6px');
  retryBtn.onclick = function () {
    var rid = resolveActiveRoomId(panelDeps);
    if (!rid) {
      panelDeps.runtime().showToast('No hay sala activa para reintentar.', 'warn');
      return;
    }
    void flushLiveSyncOutbox(rid).then(function () {
      panelDeps.runtime().showToast('Cola reintentada. Revisa el informe abajo.', 'info');
      panelDeps.renderLanPanel({ force: true });
    });
  };
  diagBody.appendChild(retryBtn);
}

/** @param {PanelDiagnosticsDeps} panelDeps @param {HTMLElement} diagBody */
function appendRecoverVitalsButton(panelDeps, diagBody) {
  var recoverBtn = createDiagnosticsSecondaryButton('Recuperar signos desde caché LAN', '6px');
  recoverBtn.onclick = function () {
    var rid = resolveActiveRoomId(panelDeps);
    if (!rid) {
      panelDeps.runtime().showToast('No hay sala activa.', 'warn');
      return;
    }
    var preview = recoverMonitoreoFromLanCache({ roomId: rid, dryRun: true });
    if (!preview.ok) {
      panelDeps.runtime().showToast(
        'No hay signos en la cola LAN ni instantáneas locales.',
        'warn'
      );
      return;
    }
    var applied = recoverMonitoreoFromLanCache({ roomId: rid });
    var msg =
      'Recuperados: ' +
      (applied.restored + applied.readded) +
      ' paciente(s) · cola ' +
      preview.sources.outbox +
      ' · snapshot ' +
      preview.sources.snapshot;
    panelDeps.runtime().showToast(msg, 'success');
    panelDeps.renderLanPanel({ force: true });
    if (typeof panelDeps.runtime().renderEstadoActualPanel === 'function') {
      try {
        panelDeps.runtime().renderEstadoActualPanel({ force: true, syncHeavy: true });
      } catch (_ea) { void _ea; }
    }
  };
  diagBody.appendChild(recoverBtn);
}

/** @returns {HTMLDetailsElement} */
function createDiagnosticsDisclosureShell() {
  var details = document.createElement('details');
  details.className = 'rpc-disclosure lan-sync-diagnostics-panel';
  try {
    details.open = sessionStorage.getItem(LAN_SYNC_DIAG_OPEN_KEY) === '1';
  } catch (_e) { void _e; }
  details.addEventListener('toggle', function () {
    try {
      sessionStorage.setItem(LAN_SYNC_DIAG_OPEN_KEY, details.open ? '1' : '0');
    } catch (_e) { void _e; }
  });
  var sum = document.createElement('summary');
  sum.className =
    'rpc-disclosure__summary rpc-disclosure__summary--stacked lan-settings-card-summary lan-sync-diagnostics-summary';
  sum.innerHTML =
    '<span class="settings-card__title">Estado de sincronización</span>' +
    '<span class="settings-card__desc">Informe técnico y cola de sync</span>';
  details.appendChild(sum);
  return details;
}

/** @param {PanelDiagnosticsDeps} panelDeps @param {object} diagDeps @param {object} diag @param {string} report */
function createLanSyncDiagnosticsSection(panelDeps, diagDeps, diag, report) {
  var details = createDiagnosticsDisclosureShell();
  var diagBody = document.createElement('div');
  diagBody.className = 'rpc-disclosure__body';
  var reportPre = document.createElement('pre');
  reportPre.className = 'lan-sync-diagnostics-pre';
  reportPre.textContent = report;
  if (shouldShowSplitServerHint(diag)) {
    var splitHintP = document.createElement('p');
    splitHintP.className = 'lan-connect-card-hint lan-sync-diagnostics-split-hint';
    splitHintP.style.margin = '0';
    splitHintP.innerHTML = SPLIT_SERVER_HINT_HTML;
    diagBody.appendChild(splitHintP);
  }
  diagBody.appendChild(reportPre);
  appendDiagnosticsCopyButton(panelDeps, diagDeps, diagBody);
  appendRetryOutboxButton(panelDeps, diagBody);
  appendRecoverVitalsButton(panelDeps, diagBody);
  details.appendChild(diagBody);
  return details;
}

/** @param {PanelDiagnosticsDeps} deps @param {HTMLElement|null} root */
async function appendLanSyncDiagnosticsSection(deps, root) {
  if (!root) return;
  var diagDeps = await buildLanSyncDiagnosticsDeps(deps);
  var diag = getLanSyncDiagnostics(diagDeps);
  var report = formatDiagnosticsReport(diag);
  var existing = root.querySelector('.lan-sync-diagnostics-panel');
  if (existing) {
    updateLanSyncDiagnosticsSection(existing, report, diag);
    return;
  }
  root.appendChild(createLanSyncDiagnosticsSection(deps, diagDeps, diag, report));
}

/** @param {PanelDiagnosticsDeps} deps */
async function refreshLanSyncDiagnosticsInPlace(deps) {
  if (!deps.isLanConnectionDropdownOpen()) return;
  var root = document.getElementById('lan-connection-panel-root');
  if (!root) return;
  var scrollTop = deps.captureConnectionDropdownScrollTop();
  await appendLanSyncDiagnosticsSection(deps, root);
  deps.restoreConnectionDropdownScrollTop(scrollTop);
}

/** @param {PanelDiagnosticsDeps} deps */
export function createPanelDiagnostics(deps) {
  return {
    renderLanPreflightUx: function (root) {
      return renderLanPreflightUx(deps, root);
    },
    appendLanSyncDiagnosticsSection: function (root) {
      return appendLanSyncDiagnosticsSection(deps, root);
    },
    refreshLanSyncDiagnosticsInPlace: function () {
      return refreshLanSyncDiagnosticsInPlace(deps);
    },
  };
}
