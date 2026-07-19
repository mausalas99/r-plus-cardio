/**
 * LAN live-sync outbox item dispatch and drain helpers.
 */
import { enqueueOutbox } from '../../live-sync-outbox.mjs';
import { guardAndSignLiveSyncMutation } from '../../clinical-access-runtime.mjs';
import { lanClient } from './runtime.mjs';
import { BUNDLE_PUSH_HANDLED, CLINICAL_OPS_HANDLED } from './push-helpers.mjs';
import { pushRoomSyncBundleToHost } from './push-bundle.mjs';
import { pushClinicalOpsPayloadToHost } from './push-conflict.mjs';
import { pushDeltaToHost, pushCommandToHost } from './push-bundle.mjs';

var OUTBOX_KIND_SCORE = {
  clinical_ops: 0,
  bundle: 1,
};

function outboxKindScore(kind) {
  return OUTBOX_KIND_SCORE[kind] != null ? OUTBOX_KIND_SCORE[kind] : 2;
}

export function sortOutboxItems(items) {
  return items.slice().sort(function (a, b) {
    return outboxKindScore(a && a.kind) - outboxKindScore(b && b.kind);
  });
}

function pushTypedMutationToHost(path, body, method) {
  var m = method || 'PUT';
  return lanClient.fetch('/api/lan/v1' + path, {
    method: m,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (res) {
    return !!(res && res.ok);
  }).catch(function () {
    return false;
  });
}

function pushLiveSyncPatchOutbox(rid, envelope) {
  if (!envelope || !envelope.mutation) return Promise.resolve(false);
  function trySend() {
    if (!lanClient.liveConnected) return Promise.resolve(false);
    return guardAndSignLiveSyncMutation(envelope.mutation, envelope)
      .then(function () {
        lanClient.sendLive(envelope);
        return true;
      })
      .catch(function () {
        return false;
      });
  }
  return trySend().then(function (sent) {
    if (sent) return true;
    try {
      lanClient.connectLiveChannel(rid);
    } catch (_e) { void _e; }
    return import('./room.mjs').then(function (mod) {
      if (typeof mod.waitForLiveChannelOpen !== 'function') return false;
      return mod.waitForLiveChannelOpen(rid, 4000).then(function () {
        return trySend();
      });
    });
  });
}

var OUTBOX_ITEM_DISPATCH = {
  clinical_ops: function (rid, item) {
    return pushClinicalOpsPayloadToHost(rid, item.payload);
  },
  bundle: function (rid, item) {
    return pushRoomSyncBundleToHost(rid, item.payload);
  },
  delta: function (rid, item) {
    return pushDeltaToHost(rid, item.payload);
  },
  command: function (rid, item) {
    return pushCommandToHost(rid, item.payload);
  },
  patch: function (rid, item) {
    return pushLiveSyncPatchOutbox(rid, item.payload);
  },
  nota_replace: function (_rid, item) {
    return pushTypedMutationToHost(
      '/patients/' + encodeURIComponent(item.payload.patientId) + '/nota',
      item.payload.data !== undefined ? item.payload : { data: item.payload }
    );
  },
  indicaciones_replace: function (_rid, item) {
    return pushTypedMutationToHost(
      '/patients/' + encodeURIComponent(item.payload.patientId) + '/indicaciones',
      item.payload.data !== undefined ? item.payload : { data: item.payload }
    );
  },
  lab_history_upsert: function (_rid, item) {
    return pushTypedMutationToHost(
      '/patients/' + encodeURIComponent(item.payload.patientId) + '/lab-history/upsert-set',
      item.payload,
      'POST'
    );
  },
  lab_history_delete: function (_rid, item) {
    return pushTypedMutationToHost(
      '/patients/' + encodeURIComponent(item.payload.patientId) + '/lab-history/delete-set',
      item.payload.data !== undefined ? item.payload.data : item.payload,
      'POST'
    );
  },
  patient_fields: function (_rid, item) {
    return pushTypedMutationToHost(
      '/patients/' + encodeURIComponent(item.payload.patientId) + '/fields',
      item.payload
    );
  },
};

export function pushOutboxItem(rid, item) {
  if (!item || !item.payload) return Promise.resolve(true);
  var handler = OUTBOX_ITEM_DISPATCH[item.kind];
  if (handler) return handler(rid, item);
  return Promise.resolve(true);
}

export function outboxItemSucceeded(result) {
  return (
    result === true ||
    result === BUNDLE_PUSH_HANDLED ||
    result === CLINICAL_OPS_HANDLED ||
    !!(result && result.removeOutbox)
  );
}

export function reenqueueOutboxSlice(rid, slice) {
  var chain = Promise.resolve();
  slice.forEach(function (it) {
    chain = chain.then(function () {
      return enqueueOutbox(rid, { kind: it.kind, payload: it.payload });
    });
  });
  return chain;
}

export function drainOutboxFromIndex(rid, sorted, index) {
  if (index >= sorted.length) return Promise.resolve();
  var item = sorted[index];
  return pushOutboxItem(rid, item).then(function (result) {
    if (result === 'paused') {
      return reenqueueOutboxSlice(rid, sorted.slice(index));
    }
    if (!outboxItemSucceeded(result)) {
      return reenqueueOutboxSlice(rid, sorted.slice(index));
    }
    return drainOutboxFromIndex(rid, sorted, index + 1);
  });
}
