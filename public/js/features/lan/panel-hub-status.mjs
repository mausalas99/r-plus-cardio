/**
 * LAN hub status copy + auto-join helpers — extracted from panel.mjs.
 */
import { isAutoHostDetectPaused } from '../../lan-host-detect-guard.mjs';
import {
  formatEscalationCountdown,
  getHostEscalationStatus,
} from '../../lan-host-escalation.mjs';
import {
  canLocalMacBeLanHost,
  isClinicalRankConfiguredForLan,
  resolveLocalOnCallGuardia,
} from '../../lan-host-rank-policy.mjs';
import {
  parseLanJoinQuery,
  resolveLiveSyncRoomIdFromSala,
} from '../../lan-join-link.mjs';
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { isLanRemoteJoinMode } from './transport.mjs';
import { lanClient, activeLiveSyncRoomId } from './runtime.mjs';
import { isLanSkipShiftPin } from '../../lan-shift-pin-bypass.mjs';

export function shouldOmitLanHubStatusHint(hubStatus) {
  return !!(
    hubStatus &&
    hubStatus.connected &&
    !isLanRemoteJoinMode() &&
    String(hubStatus.line || '').indexOf('servidor del turno') !== -1
  );
}

function lanHubPausedCopy() {
  return {
    connected: false,
    line: 'Sin anfitrión detectado',
    hint: isLanSkipShiftPin()
      ? 'Búsqueda automática en pausa (5 intentos). Pulsa Conectar al turno, pega el enlace del anfitrión en ⇄ o Restablecer conexión.'
      : 'Búsqueda automática en pausa (5 intentos). Usa PIN, Restablecer conexión ⇄ o vuelve a abrir este panel.',
  };
}

export function classifyAutoJoinSource() {
  if (typeof location !== 'undefined') {
    var parsedUrl = parseLanJoinQuery(location.search, location.origin);
    if (String(parsedUrl.roomId || '').trim()) return 'url';
  }
  var mem = getRoomMembership();
  if (mem && mem.roomId) return 'membership';
  try {
    var s = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    if (resolveLiveSyncRoomIdFromSala(s.clinicalSala)) return 'settings_sala';
  } catch {
    return 'none';
  }
  return 'none';
}

export function resolveAutoJoinRoomId(explicitRoomId) {
  var rid = String(explicitRoomId || '').trim();
  if (rid) return rid;
  if (typeof location !== 'undefined') {
    var parsed = parseLanJoinQuery(location.search, location.origin);
    rid = String(parsed.roomId || '').trim();
    if (rid) return rid;
  }
  var mem = getRoomMembership();
  if (mem && mem.roomId) return String(mem.roomId).trim();
  try {
    var s = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    return resolveLiveSyncRoomIdFromSala(s.clinicalSala);
  } catch {
    return '';
  }
}

function lanAutoJoinConfirmedSessionKey(roomId) {
  return 'rpc-lan-auto-join-confirmed-' + String(roomId || '').trim();
}

export function hasLanAutoJoinConfirmed(roomId) {
  try {
    return sessionStorage.getItem(lanAutoJoinConfirmedSessionKey(roomId)) === '1';
  } catch {
    return false;
  }
}

export function setLanAutoJoinConfirmed(roomId) {
  try {
    sessionStorage.setItem(lanAutoJoinConfirmedSessionKey(roomId), '1');
  } catch (_e) { void _e; }
}

export function lanHubStatusCopy() {
  if (!lanClient.connected) {
    if (isAutoHostDetectPaused()) {
      return lanHubPausedCopy();
    }
    if (!isClinicalRankConfiguredForLan()) {
      return {
        connected: false,
        line: 'Configura tu rotación para usar la red del turno',
        hint: 'Abre «Configura tu rotación» y confirma rango y sala; después buscaremos al anfitrión en la Wi‑Fi.',
      };
    }
    if (!canLocalMacBeLanHost()) {
      var hostEsc = getHostEscalationStatus();
      var nextRank = ['R3', 'R2', 'R1'][hostEsc.tier] || '';
      var escHint =
        hostEsc.tier < 3 && hostEsc.msUntilNext > 0
          ? 'Sin R4/admin en la red: en ' +
            formatEscalationCountdown(hostEsc.msUntilNext) +
            ' podrá anfitrionar ' +
            nextRank +
            ' (escalada automática 10+10+10 min).'
          : 'R1–R3 esperan anfitrión R4 o escalada. Pide enlace (⇄) o pégalo abajo.';
      return {
        connected: false,
        line: 'Sin conexión al turno',
        hint: isLanSkipShiftPin()
          ? 'Pulsa Conectar al turno arriba o pega el enlace del anfitrión en ⇄. ' + escHint
          : 'Pide el PIN de 6 dígitos al anfitrión (⇄) o pulsa Conectar al turno arriba. ' + escHint,
      };
    }
    var onCallHost = resolveLocalOnCallGuardia();
    return {
      connected: false,
      line: onCallHost ? 'De guardia hoy — listo para anfitrionar' : 'Sin conexión al turno',
      hint: onCallHost
        ? 'Esta Mac puede ser el servidor del turno en tu Wi‑Fi. Pulsa Conectar al turno o abre ⇄.'
        : isLanSkipShiftPin()
          ? 'Pulsa Conectar al turno o pega el enlace del anfitrión en ⇄.'
          : 'Pide el PIN de 6 dígitos al anfitrión (⇄) o conéctate abajo.',
    };
  }
  if (isLanRemoteJoinMode()) {
    var remoteUrl = String(lanClient.baseUrl() || '').replace(/\/+$/, '');
    return {
      connected: true,
      line: 'Conectado al anfitrión del turno',
      hint: remoteUrl ? 'Servidor: ' + remoteUrl : '',
    };
  }
  return {
    connected: true,
    line: activeLiveSyncRoomId
      ? 'Esta Mac es el servidor del turno'
      : 'Servidor local activo — comparte el enlace de invitación',
    hint:
      'Comparte el enlace de sala (⇄ → Copiar enlace de sala). Para iPad usa «Copiar enlace móvil». No activen otro servidor salvo suplente.',
  };
}
