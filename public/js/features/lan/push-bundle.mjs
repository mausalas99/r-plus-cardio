/**
 * LAN room sync-bundle HTTP push.
 */
import { enqueueOutbox } from '../../live-sync-outbox.mjs';
import { setHostBundleBases } from '../../host-bundle-bases.mjs';
import { recordLanSyncError } from '../../lan-sync-diagnostics.mjs';
import { isBundlePushPaused } from '../../lan-sync-bundle-push.mjs';
import { lanFetchAuthed } from './transport-session.mjs';
import { bridge, ensureLanSyncPushBridgeWired } from './push-bridge.mjs';
import { liveSyncBundleHasPayload, hostBundleBodyFromEnvelope } from './push-helpers.mjs';
import {
  applyServerBundleLwwLocally,
  finishBundle409Locally,
  notifyBundleLwwOverwrite,
} from './push-conflict.mjs';
import { emitLiveSyncRevisionHint } from './push-revision.mjs';

async function pushDeltaToHost(roomId, envelope) {
  const rid = String(roomId || '').trim();
  if (!rid || !envelope) return false;
  const body = envelope.delta || envelope;
  const resp = await lanClient.fetch('/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/delta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp && (resp.ok || resp.status === 409);
}

async function pushCommandToHost(roomId, envelope) {
  const rid = String(roomId || '').trim();
  const command = envelope && (envelope.command || envelope.payload || envelope);
  if (!rid || !command) return false;
  const resp = await lanClient.fetch('/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body = await resp.json().catch(function () {
    return {};
  });
  const { normalizeCommandPushResponse } = await import('../../lan-command-client.mjs');
  return normalizeCommandPushResponse({ ok: !!(resp && resp.ok), status: resp && resp.status, body });
}

export { pushDeltaToHost, pushCommandToHost };

export function pushRoomSyncBundleToHost(roomId, envelope) {
  return ensureLanSyncPushBridgeWired().then(function () {
    return pushRoomSyncBundleToHostBody(roomId, envelope);
  });
}

function pushRoomSyncBundleToHostBody(roomId, envelope) {
  var b = bridge();
  if (typeof b.isLanSessionConfiguredForRest !== 'function' || !b.isLanSessionConfiguredForRest()) {
    return Promise.resolve(false);
  }
  var rid = String(roomId || '').trim();
  if (!rid || !envelope || !liveSyncBundleHasPayload(envelope)) return Promise.resolve(false);
  if (isBundlePushPaused(rid)) return Promise.resolve('paused');
  return lanFetchAuthed('/api/lan/v1/rooms/' + encodeURIComponent(rid) + '/sync-bundle', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle: hostBundleBodyFromEnvelope(envelope, rid),
      }),
    })
    .then(function (resp) {
      if (!resp) return false;
      if (resp.status === 409) {
        return resp.json().then(function (body) {
          var serverBundle = body && body.bundle ? body.bundle : null;
          var lwwKeys =
            body && Array.isArray(body.lwwAppliedKeys) ? body.lwwAppliedKeys : ['*'];
          if (!serverBundle) {
            enqueueOutbox(rid, { kind: 'bundle', payload: envelope });
            return finishBundle409Locally(rid, b, {});
          }
          applyServerBundleLwwLocally(rid, b, serverBundle, lwwKeys);
          return finishBundle409Locally(rid, b, {});
        });
      }
      if (resp.ok) {
        return resp.json().then(function (body) {
          if (body && body.bundle) {
            setHostBundleBases(rid, body.bundle);
            emitLiveSyncRevisionHint(rid, body.bundle.revision);
          }
          notifyBundleLwwOverwrite(
            b,
            rid,
            body && Array.isArray(body.lwwAppliedKeys) ? body.lwwAppliedKeys : []
          );
          return true;
        });
      }
      return resp.json().then(function (body) {
        var detail = body && body.error ? String(body.error) : '';
        recordLanSyncError({
          op: 'sync-bundle',
          code: String(resp.status || 'HTTP'),
          message: 'PUT sync-bundle rechazado' + (detail ? ': ' + detail : ''),
        });
        return false;
      }).catch(function () {
        recordLanSyncError({
          op: 'sync-bundle',
          code: String(resp.status || 'HTTP'),
          message: 'PUT sync-bundle rechazado',
        });
        return false;
      });
    })
    .catch(function (err) {
      recordLanSyncError({
        op: 'sync-bundle',
        code: 'NETWORK',
        message: err && err.message ? err.message : 'PUT sync-bundle falló',
      });
      return false;
    });
}
