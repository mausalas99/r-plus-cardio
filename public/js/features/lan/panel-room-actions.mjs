/**
 * LAN room CRUD + settings host actions — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { liveSyncRoomLabel } from '../../lan-join-link.mjs';
import { recordLanSyncError } from '../../lan-sync-diagnostics.mjs';
import { lanNetworkProfile } from '../../lan-network-profile.mjs';
import { resumeAutoHostDetect } from '../../lan-host-detect-guard.mjs';
import {
  isLanSessionConfiguredForRest,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  resolveLanHostUrlForShare,
  resolveHostBearerToken,
  resolveLanTeamCodeForShare,
  ensureLanClientTeamCodeAligned,
  lanFetchAuthed,
  maybeShowLanMigrationNotice,
  syncLanSavedTeamCodeWithEffectiveHostCode,
} from './transport.mjs';
import { joinLanRoom, leaveLiveSyncRoom, resumeAutoHostDetectAndReconnect } from './room.mjs';
import { flushLiveSyncOutbox, reconcileLiveSyncRoom, ensureEffectiveLiveSyncRoomId } from './push.mjs';
import { lanClient, activeLiveSyncRoomId } from './runtime.mjs';
import {
  classifyAutoJoinSource,
  resolveAutoJoinRoomId,
  hasLanAutoJoinConfirmed,
  setLanAutoJoinConfirmed,
} from './panel-hub-status.mjs';

const LAN_HOST_CODE_HINT_SEEN_KEY = 'rpc-lan-host-code-hint-seen';

function isElectronHostTeamCodeWriter() {
  return !!(window.electronAPI && typeof window.electronAPI.writeLanHostTeamCode === 'function');
}

function isElectronHostStateResetter() {
  return !!(window.electronAPI && typeof window.electronAPI.resetLanSquadHostState === 'function');
}

function applyHostTeamCodeToLanClient(plainTrim) {
  var cfg = typeof storage.getLanConfig === 'function' ? (storage.getLanConfig() || {}) : {};
  var hostUrl = String(cfg.hostUrl || '').trim().replace(/\/+$/, '');
  if (!hostUrl || !plainTrim) return;
  storage.saveLanConfig({ hostUrl: hostUrl, teamCode: plainTrim });
  lanClient.configure({ hostUrl: hostUrl, teamCode: plainTrim });
  try {
    lanClient.disconnect();
    lanClient.connectSyncChannel();
  } catch (_e) { void _e; }
}

/** @param {object} deps */
async function saveLanHostTeamCodeFromUi(deps) {
  if (!isElectronHostTeamCodeWriter()) {
    deps.runtime().showToast('Solo disponible en la app Electron', 'error');
    return;
  }
  var input = document.getElementById('settings-lan-host-team-code-input');
  var plain = input && input.value;
  var res;
  try {
    res = await window.electronAPI.writeLanHostTeamCode(plain);
  } catch (e) {
    deps.runtime().showToast(e && e.message ? e.message : 'Error al guardar', 'error');
    return;
  }
  if (!res || !res.ok) {
    deps.runtime().showToast(res && res.error ? res.error : 'Error al guardar', 'error');
    return;
  }
  var plainTrim = String(plain || '').trim();
  if (!plainTrim) {
    deps.runtime().showToast('Escribe un token de al menos 32 caracteres.', 'error');
    return;
  }
  applyHostTeamCodeToLanClient(plainTrim);
  deps.runtime().showToast('Guardado. Reinicia R+ para que el proceso del servidor relea el archivo.', 'success');
}

/** @param {object} deps */
async function resetLanSquadHostStateFromUi(deps) {
  if (!isElectronHostStateResetter()) {
    deps.runtime().showToast('Solo disponible en la app de escritorio.', 'error');
    return;
  }
  if (
    !confirm(
      'Se borrará el archivo lan-squad-host-state.json en esta computadora (salas, pacientes del host LAN y la caché clinicalOps del bundle). Los equipos, directorio y guardias en la base clínica SQLCipher no se borran. ¿Seguir?'
    )
  ) {
    return;
  }
  var res;
  try {
    res = await window.electronAPI.resetLanSquadHostState();
  } catch (e) {
    deps.runtime().showToast(e && e.message ? e.message : 'Error al restablecer', 'error');
    return;
  }
  if (!res || !res.ok) {
    deps.runtime().showToast(res && res.error ? res.error : 'No se pudo borrar el archivo.', 'error');
    return;
  }
  var synced = await syncLanSavedTeamCodeWithEffectiveHostCode();
  resumeAutoHostDetectAndReconnect();
  deps.runtime().showToast(
    synced
      ? 'Estado LAN del host borrado. El «Código del equipo» guardado en esta R+ quedó alineado con archivo / variable de entorno / valor por defecto del servidor.'
      : 'Estado LAN del host borrado. Si sigues con error 401, escribe en «Código del equipo» el mismo texto que el servidor (o reinicia R+ tras cambiar el archivo).',
    'success'
  );
  deps.renderLanPanel({ force: true });
}

function getLanUiRole() {
  return typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
}

async function resolveHostUrlFromUi() {
  var hostInput = document.getElementById('lan-input-host-url');
  if (hostInput && !String(hostInput.value || '').trim()) {
    var autoHost = await resolveLanHostUrlForShare();
    if (autoHost) hostInput.value = autoHost;
  }
  return String(hostInput && hostInput.value ? hostInput.value : '')
    .trim()
    .replace(/\/+$/, '');
}

async function resolveTeamCodeForUiRole(uiRole) {
  if (uiRole === 'host') {
    return String(await resolveHostBearerToken()).trim();
  }
  return String(await resolveLanTeamCodeForShare()).trim();
}

function getMissingLanSettingsMessage(hostUrl, teamCode, uiRole) {
  if (hostUrl && teamCode) return '';
  if (!hostUrl) {
    return uiRole === 'host'
      ? 'No pudimos detectar la IP. Escribe la dirección http://… que verán las otras R+.'
      : 'Escribe la dirección del servidor que te dio el anfitrión.';
  }
  return uiRole === 'host'
    ? 'No hay token seguro del servidor en esta Mac. Reinicia R+ como anfitrión.'
    : 'Únete con el enlace o PIN que te dio quien abrió la sala.';
}

function persistAndConnectLanSettings(deps, cfg) {
  storage.saveLanConfig(cfg);
  lanClient.configure(cfg);
  lanClient.disconnect();
  try {
    deps.getConnectionManager().connect(cfg.hostUrl, cfg.teamCode);
  } catch (_e) { void _e; }
}

/** @returns {Promise<{ pingOk: boolean, pingStatus: number }>} */
async function pingLanServer(deps) {
  try {
    var pingStart = Date.now();
    var r = await lanClient.fetch('/api/lan/v1/ping');
    var pingRtt = Date.now() - pingStart;
    var pingStatus = r && r.status ? r.status : 0;
    var pingOk = !!(r && r.ok);
    if (pingOk) {
      lanNetworkProfile.recordPingSuccess(pingRtt);
      deps.writePingState({ at: new Date().toISOString(), status: pingStatus, rttMs: pingRtt });
    } else {
      lanNetworkProfile.recordPingFailure();
      deps.writePingState({ at: new Date().toISOString(), status: pingStatus, rttMs: 0 });
    }
    return { pingOk, pingStatus };
  } catch (pingErr) {
    lanNetworkProfile.recordPingFailure();
    deps.writePingState({ at: new Date().toISOString(), status: 0, rttMs: 0 });
    recordLanSyncError({
      op: 'ping',
      code: 'NETWORK',
      message: pingErr && pingErr.message ? pingErr.message : 'ping failed',
    });
    return { pingOk: false, pingStatus: 0 };
  }
}

/** @returns {boolean} true when user cancelled auto-join confirm */
function tryAutoJoinLanRoom(deps) {
  var autoRoomId = resolveAutoJoinRoomId('');
  if (!autoRoomId) return false;
  var joinSource = classifyAutoJoinSource();
  var needsConfirm = joinSource === 'settings_sala' && !hasLanAutoJoinConfirmed(autoRoomId);
  if (needsConfirm) {
    var salaLabel = liveSyncRoomLabel(autoRoomId);
    if (typeof confirm !== 'function' || !confirm('¿Unirte a ' + salaLabel + '?')) {
      deps.renderLanPanel({ force: true });
      return true;
    }
    setLanAutoJoinConfirmed(autoRoomId);
  }
  joinLanRoom(autoRoomId, liveSyncRoomLabel(autoRoomId));
  return false;
}

function schedulePostPingSideEffects() {
  void import('../../historia-clinica-lan-sync.mjs').then(function (m) {
    return m.scheduleFlushAllPendingHistoriaClinicaLanSync();
  });
  void maybeShowLanMigrationNotice();
}

function showSaveLanSettingsSuccessToast(deps, copyInviteAfter, copiedOk) {
  if (copyInviteAfter) {
    deps.runtime().showToast(
      copiedOk
        ? 'Anfitrión listo. La invitación ya está en el portapapeles; compártela por WhatsApp o correo.'
        : 'Anfitrión listo, pero no se pudo copiar solo. Pulsa «Copiar enlace de sala» o «Generar y mostrar» en ⇄.',
      copiedOk ? 'success' : 'error'
    );
    return;
  }
  deps.runtime().showToast('Listo: ya iniciaste sesión en la sala del equipo.', 'success');
}

function showSaveLanSettingsFailureToast(deps, pingStatus, copyInviteAfter, copiedOk) {
  if (pingStatus === 401) {
    deps.runtime().showToast('El código no coincide con el del servidor. Pide el código correcto a quien tiene la computadora anfitriona.', 'error');
    return;
  }
  if (copyInviteAfter && copiedOk) {
    deps.runtime().showToast(
      'Invitación copiada al portapapeles. Aun así no hubo respuesta del servidor: revisa el Wi‑Fi o que R+ siga abierto en el anfitrión.',
      'error'
    );
    return;
  }
  deps.runtime().showToast(
    'Guardamos los datos, pero no hubo respuesta del servidor. Revisa la dirección y que ambas computadoras estén en el mismo Wi‑Fi.',
    'error'
  );
}

/** @param {object} deps @param {object} [opts] */
async function saveLanSettingsFromUi(deps, opts) {
  opts = opts || {};
  var copyInviteAfter = !!opts.copyInviteAfter;
  var uiRole = getLanUiRole();
  var hostUrl = await resolveHostUrlFromUi();
  var teamCode = await resolveTeamCodeForUiRole(uiRole);
  var missingMsg = getMissingLanSettingsMessage(hostUrl, teamCode, uiRole);
  if (missingMsg) {
    deps.runtime().showToast(missingMsg, 'error');
    return;
  }
  var cfg = { hostUrl: hostUrl.replace(/\/+$/, ''), teamCode: teamCode };
  persistAndConnectLanSettings(deps, cfg);
  var pingResult = await pingLanServer(deps);
  var copiedOk = false;
  if (copyInviteAfter && pingResult.pingStatus !== 401) {
    copiedOk = await deps.copyLanInviteLinkFromUi({ silent: true });
  }
  if (pingResult.pingStatus === 401) {
    recordLanSyncError({ op: 'ping', code: '401', message: 'team code rejected' });
  }
  if (pingResult.pingOk) {
    if (tryAutoJoinLanRoom(deps)) return;
    schedulePostPingSideEffects();
    showSaveLanSettingsSuccessToast(deps, copyInviteAfter, copiedOk);
  } else {
    showSaveLanSettingsFailureToast(deps, pingResult.pingStatus, copyInviteAfter, copiedOk);
  }
  deps.renderLanPanel({ force: true });
}

function showCreateRoomErrorToast(deps, status) {
  if (status === 401) {
    deps.runtime().showToast(
      'El código del equipo no coincide con el servidor. Igualálo al conectar y en lan-team-code.txt; reinicia R+ en el anfitrión si cambiaste el archivo.',
      'error'
    );
    return;
  }
  deps.runtime().showToast('No se pudo crear la sala', 'error');
}

function finishCreateLanRoom(deps, newRoom, displayName, input) {
  if (newRoom && newRoom.id) {
    joinLanRoom(newRoom.id, newRoom.displayName || displayName);
  }
  if (input) input.value = '';
  deps.runtime().showToast(
    newRoom && newRoom.id ? 'Sala creada y conectada' : 'Sala creada — pulsa Unirse',
    'success'
  );
  deps.renderLanPanel({ force: true });
}

/** @param {object} deps */
async function createLanRoomFromUi(deps) {
  if (!isLanSessionConfiguredForRest()) {
    deps.runtime().showToast('Falta la dirección LAN. Configura la conexión en ⇄ y vuelve a intentar.', 'error');
    return;
  }
  await ensureLanClientTeamCodeAligned();
  var input = document.getElementById('lan-input-room-name');
  var displayName = String(input && input.value ? input.value : '').trim();
  if (!displayName) {
    deps.runtime().showToast('Escribe un nombre de sala', 'error');
    return;
  }
  var resp;
  try {
    resp = await lanFetchAuthed('/api/lan/v1/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: displayName })
    });
  } catch {
    deps.runtime().showToast('No se pudo crear la sala', 'error');
    return;
  }
  if (!resp.ok) {
    showCreateRoomErrorToast(deps, resp.status);
    return;
  }
  var created;
  try {
    created = await resp.json();
  } catch {
    created = null;
  }
  finishCreateLanRoom(deps, created && created.room, displayName, input);
}

function showDeleteRoomErrorToast(deps, status) {
  if (status === 401) {
    deps.runtime().showToast('El código del equipo no coincide con el servidor; no se pudo eliminar la sala.', 'error');
    return;
  }
  deps.runtime().showToast('No se pudo eliminar la sala', 'error');
}

/** @param {object} deps @param {string} roomId */
async function deleteLanRoom(deps, roomId) {
  if (!isLanSessionConfiguredForRest()) {
    deps.runtime().showToast('Falta configuración LAN para eliminar salas.', 'error');
    return;
  }
  await ensureLanClientTeamCodeAligned();
  var id = String(roomId || '').trim();
  if (!id) return;
  if (activeLiveSyncRoomId === id) {
    leaveLiveSyncRoom({ silentLeave: true });
  }
  var resp;
  try {
    resp = await lanFetchAuthed('/api/lan/v1/rooms/' + encodeURIComponent(id), { method: 'DELETE' });
  } catch {
    deps.runtime().showToast('No se pudo eliminar la sala', 'error');
    return;
  }
  if (!resp.ok) {
    showDeleteRoomErrorToast(deps, resp.status);
    return;
  }
  deps.runtime().showToast('Sala eliminada', 'success');
  deps.renderLanPanel({ force: true });
}

function syncLanHostFirstTimeHintUi() {
  var hint = document.getElementById('lan-host-first-time-hint');
  if (hint) hint.style.display = 'none';
}

function dismissLanHostFirstTimeHint() {
  try {
    localStorage.setItem(LAN_HOST_CODE_HINT_SEEN_KEY, '1');
  } catch (_e) { void _e; }
  syncLanHostFirstTimeHintUi();
}

function showOfflineReconnectError(btn) {
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Reconectar';
  }
  var errEl = document.querySelector('.lan-offline-banner__error');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'lan-offline-banner__error';
    if (btn && btn.parentNode) btn.parentNode.insertBefore(errEl, btn);
  }
  errEl.textContent = 'No se encontró el anfitrión.';
}

async function flushAndReconcileAfterReconnect() {
  try {
    var rid =
      String(activeLiveSyncRoomId || '').trim() ||
      (typeof ensureEffectiveLiveSyncRoomId === 'function' ? ensureEffectiveLiveSyncRoomId() : '');
    if (!rid) return;
    await flushLiveSyncOutbox(rid);
    await reconcileLiveSyncRoom(rid, { force: true, reason: 'reconnect' });
  } catch (_e) { void _e; }
}

/** @param {object} deps */
async function reconnectFromOfflineUi(deps) {
  var btn = document.querySelector('[data-lan-action="reconnect-from-offline"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Buscando…';
  }
  var pingOk = false;
  var rttMs = 0;
  try {
    var start = Date.now();
    var r = await lanClient.fetch('/api/lan/v1/ping');
    rttMs = Date.now() - start;
    pingOk = !!(r && r.ok);
  } catch {
    pingOk = false;
  }
  lanNetworkProfile._simulatePingResult(pingOk, rttMs);
  const newProfile = lanNetworkProfile.getNetworkProfile();
  if (!pingOk || newProfile === 'offline') {
    showOfflineReconnectError(btn);
    return;
  }
  await flushAndReconcileAfterReconnect();
  resumeAutoHostDetect();
  deps.startLanAutoDiscovery();
  deps.renderLanPanel({ force: true });
}


function syncSettingsLanHostDiskSection() {
  var acc = document.getElementById('settings-accordion-lan-host-disk');
  if (!acc) return;
  var desktop = isLanElectronDesktop();
  acc.style.display = desktop && !isLanRemoteJoinMode() ? '' : 'none';
  if (!desktop || isLanRemoteJoinMode()) return;
  syncLanHostTeamCodeSettingsInput();
  syncLanHostFirstTimeHintUi();
  void import('../settings-help/settings-dropdown.mjs')
    .then(function (m) {
      if (typeof m.syncSettingsNavVisibility === 'function') m.syncSettingsNavVisibility();
    })
    .catch(function () {});
}

async function syncLanHostTeamCodeSettingsInput() {
  var input = document.getElementById('settings-lan-host-team-code-input');
  if (!input) return;
  var code = await resolveHostBearerToken();
  if (!String(input.value || '').trim() && code) input.value = code;
}

/** @param {{
 *   runtime: () => object,
 *   renderLanPanel: (opts?: object) => void,
 *   getConnectionManager: () => object,
 *   copyLanInviteLinkFromUi: (opts?: object) => Promise<boolean>,
 *   readPingState: () => { at: string|null, status: number, rttMs: number },
 *   writePingState: (patch: { at?: string|null, status?: number, rttMs?: number }) => void,
 *   startLanAutoDiscovery: () => void,
 * }} deps */
export function createPanelRoomActions(deps) {
  return {
    saveLanHostTeamCodeFromUi: () => saveLanHostTeamCodeFromUi(deps),
    resetLanSquadHostStateFromUi: () => resetLanSquadHostStateFromUi(deps),
    saveLanSettingsFromUi: (opts) => saveLanSettingsFromUi(deps, opts),
    createLanRoomFromUi: () => createLanRoomFromUi(deps),
    deleteLanRoom: (roomId) => deleteLanRoom(deps, roomId),
    syncLanHostFirstTimeHintUi,
    dismissLanHostFirstTimeHint,
    reconnectFromOfflineUi: () => reconnectFromOfflineUi(deps),
    syncSettingsLanHostDiskSection,
    syncLanHostTeamCodeSettingsInput,
  };
}
