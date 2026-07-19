/**
 * LAN push helpers and bundle payload checks.
 */
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { hostBundlePutBodyFromEnvelope } from '../../host-bundle-bases.mjs';
import { lanClient, activeLiveSyncRoomId, getLanClientId, setActiveLiveSyncRoom } from './runtime.mjs';

export var BUNDLE_PUSH_HANDLED = 'handled';
export var CLINICAL_OPS_HANDLED = 'handled';

export function ensureEffectiveLiveSyncRoomId() {
  var roomId = String(activeLiveSyncRoomId || '').trim();
  if (roomId) return roomId;
  var mem = getRoomMembership();
  if (!mem || !mem.roomId) return '';
  roomId = String(mem.roomId).trim();
  setActiveLiveSyncRoom(roomId, mem.label || roomId);
  return roomId;
}

var CLINICAL_OPS_PAYLOAD_KEYS = [
  'rotation_cycles',
  'patient_team_assignment',
  'team_guardia_today',
  'active_guardias',
  'teams',
  'team_membership',
  'clinical_users',
];

function arraySectionHasItems(clinicalOps, key) {
  return Array.isArray(clinicalOps[key]) && clinicalOps[key].length > 0;
}

function clinicalOpsBundleHasPayload(clinicalOps) {
  if (!clinicalOps || typeof clinicalOps !== 'object') return false;
  for (var i = 0; i < CLINICAL_OPS_PAYLOAD_KEYS.length; i += 1) {
    if (arraySectionHasItems(clinicalOps, CLINICAL_OPS_PAYLOAD_KEYS[i])) return true;
  }
  return false;
}

function todosBundleHasPayload(todos) {
  if (!todos || typeof todos !== 'object') return false;
  var keys = Object.keys(todos);
  for (var i = 0; i < keys.length; i += 1) {
    if (Array.isArray(todos[keys[i]]) && todos[keys[i]].length > 0) return true;
  }
  return false;
}

export function liveSyncBundleHasPayload(bundle) {
  if (!bundle) return false;
  if (Array.isArray(bundle.entries) && bundle.entries.length > 0) return true;
  if (Array.isArray(bundle.agenda) && bundle.agenda.length > 0) return true;
  if (todosBundleHasPayload(bundle.todos)) return true;
  return clinicalOpsBundleHasPayload(bundle.clinicalOps);
}

export function hostBundleBodyFromEnvelope(envelope, roomId) {
  var body = hostBundlePutBodyFromEnvelope(roomId, envelope);
  body.uploadedByClientId = envelope.clientId || getLanClientId();
  return body;
}

/** @returns {boolean} */
export function sendLiveBundleIfOpen(roomId, envelope) {
  var rid = String(roomId || '').trim();
  if (!rid || !envelope) return false;
  var ws = lanClient._liveWs;
  if (!lanClient.liveConnected || String(lanClient.liveRoomId || '').trim() !== rid) return false;
  if (!ws || ws.readyState !== 1) return false;
  try {
    return lanClient.sendLive(envelope) === true;
  } catch {
    return false;
  }
}

/**
 * @param {boolean} ok
 * @param {string} [code]
 * @param {{ http?: boolean, live?: boolean, outbox?: boolean }} [channels]
 */
export function lanPushResult(ok, code, channels) {
  return { ok: !!ok, code: code || undefined, channels: channels || {} };
}
