/**
 * LAN patient delete / host census purge.
 */
import { activeLiveSyncRoomId, getLanClientId } from './runtime.mjs';
import { clinicalSessionContext } from '../../clinical-session-context.mjs';
import { isHostPatientOwnedByOtherClient } from './host-patients-annotate.mjs';
import { invalidateHostPatientsCache } from './host-patients-snapshot.mjs';
import { isLanSessionConfiguredForRest, lanFetchAuthed } from './transport.mjs';
import { enqueueOutbox } from '../../live-sync-outbox.mjs';
import { createMutationBuilder, wrapLiveSyncPatch } from '../../versioned-mutation.mjs';
import { flushLiveSyncOutbox } from './push.mjs';
import { rememberPatientDeleteTombstone } from './entity-versions.mjs';
import { patients, setPatients } from '../../app-state.mjs';
import {
  clearPatientAgendaLocal,
  clearPatientLocalStateMaps,
  clearPatientTodosLocal,
} from './patient-delete-local.mjs';

/** @type {{
 *   lanFetchHostPatientRow?: (patientId: string) => Promise<object|null>,
 *   lanPushPatientVersioned?: (patientId: string, mutation: object) => Promise<object>,
 *   emitLiveSyncPatientDelete?: (patient: object) => void,
 *   scheduleLiveSyncPush?: () => void,
 *   runtime?: { getActiveId?: () => string|null, setActiveId?: (id: string|null) => void },
 * }} */
let deleteDeps = {};

export function configureLanPatientDelete(deps) {
  if (deps && typeof deps === 'object') Object.assign(deleteDeps, deps);
}

export function removePatientLocally(patientId) {
  var pid = String(patientId || '').trim();
  if (!pid || pid.indexOf('demo-') === 0) return false;
  if (!patients.some(function (p) {
    return p && p.id === pid;
  })) {
    return false;
  }
  setPatients(patients.filter(function (p) {
    return p.id !== pid;
  }));
  clearPatientLocalStateMaps(pid);
  clearPatientTodosLocal(pid);
  clearPatientAgendaLocal(pid);
  var rt = deleteDeps.runtime;
  if (rt && typeof rt.getActiveId === 'function' && rt.getActiveId() === pid) {
    rt.setActiveId(patients.length ? patients[0].id : null);
  }
  return true;
}

async function readOwnedByOtherClientError(resp) {
  var body = null;
  try {
    body = await resp.json();
  } catch { /* ignored */ }
  if (body && body.error === 'owned_by_other_client') {
    return { ok: false, error: 'owned_by_other_client', skipped: true, status: 403 };
  }
  return null;
}

async function tryBundleOnlyCensusDelete(pid, reg) {
  var bundleDelete = await lanDeleteHostPatientCensus(pid, reg);
  if (bundleDelete?.ok) return { ok: true, via: 'delete_bundle' };
  return null;
}

async function tryVersionedThenCensusDelete(pid, hostRow, reg, mutation) {
  var pushVersioned = deleteDeps.lanPushPatientVersioned;
  var httpResult = hostRow && typeof pushVersioned === 'function' ? await pushVersioned(pid, mutation) : null;
  if (httpResult?.ok) return { ok: true, result: httpResult };
  var censusDelete = await lanDeleteHostPatientCensus(pid, reg);
  if (censusDelete?.ok) return { ok: true, result: { ok: true, via: 'delete_census' } };
  return { ok: false, httpResult, censusDelete };
}

export function buildPatientDeleteMutation(patientId, hostRow, registroFallback) {
  var pid = String(patientId || '').trim();
  var base =
    hostRow && typeof hostRow === 'object'
      ? Object.assign({}, hostRow, {
          id: pid,
          version: Number(hostRow.version || 1),
        })
      : {
          id: pid,
          registro: String(registroFallback || '').trim(),
          version: 0,
        };
  return createMutationBuilder('patient', pid).captureBase(base).build({
    roomId: activeLiveSyncRoomId,
    op: 'delete',
  });
}

export async function lanDeleteHostPatientCensus(patientId, registro) {
  var pid = String(patientId || '').trim();
  if (!pid) return { ok: false, error: 'invalid_id' };
  var reg = String(registro || '').trim();
  var params = new URLSearchParams();
  if (reg) params.set('registro', reg);
  var cid = String(getLanClientId() || '').trim();
  if (cid) params.set('clientId', cid);
  if (clinicalSessionContext.user && clinicalSessionContext.user.is_program_admin === 1) {
    params.set('isProgramAdmin', '1');
  }
  var qs = params.toString();
  var resp = await lanFetchAuthed(
    '/api/lan/v1/patients/' + encodeURIComponent(pid) + (qs ? '?' + qs : ''),
    { method: 'DELETE' }
  );
  if (resp.status === 403) {
    var owned = await readOwnedByOtherClientError(resp);
    if (owned) return owned;
  }
  if (resp.ok || resp.status === 404) return { ok: true, status: resp.status };
  return { ok: false, status: resp.status };
}

async function enqueuePatientDeletePatch(pid, hostRow, reg, httpResult) {
  var rid = String(activeLiveSyncRoomId || '').trim();
  var mutation = buildPatientDeleteMutation(pid, hostRow, reg);
  await enqueueOutbox(rid, {
    kind: 'patch',
    payload: wrapLiveSyncPatch(rid, getLanClientId(), mutation),
  });
  await flushLiveSyncOutbox(rid);
  return {
    ok: false,
    error: httpResult?.status ? 'host_reject_' + httpResult.status : 'purge_failed',
    status: httpResult?.status,
  };
}

async function pushHostOnlyPatientDelete(pid, reg) {
  var hostOnlyDelete = await lanDeleteHostPatientCensus(pid, reg);
  if (hostOnlyDelete?.ok) return { ok: true, via: 'delete_census' };
  return {
    ok: false,
    error: hostOnlyDelete?.status ? 'host_reject_' + hostOnlyDelete.status : 'purge_failed',
    status: hostOnlyDelete?.status,
  };
}

async function pushPatientDeleteWithoutHostRow(pid, reg, mutation) {
  var bundleOnly = await tryBundleOnlyCensusDelete(pid, reg);
  if (bundleOnly) return bundleOnly;
  var attempts = await tryVersionedThenCensusDelete(pid, null, reg, mutation);
  if (attempts.ok) return attempts.result;
  return {
    ok: false,
    error: attempts.censusDelete?.status
      ? 'host_reject_' + attempts.censusDelete.status
      : 'purge_failed',
    status: attempts.censusDelete?.status,
  };
}

/** HTTP-first delete; bundle-only charts use DELETE /patients/:id. */
export async function pushPatientDeleteToHost(patientId, hostRow, registroFallback, purgeOpts) {
  purgeOpts = purgeOpts || {};
  var pid = String(patientId || '').trim();
  var reg = String(registroFallback || (hostRow && hostRow.registro) || '').trim();
  if (!String(activeLiveSyncRoomId || '').trim()) return { ok: false, error: 'not_configured' };

  if (purgeOpts.hostOnly) return pushHostOnlyPatientDelete(pid, reg);

  if (!hostRow) {
    return pushPatientDeleteWithoutHostRow(pid, reg, buildPatientDeleteMutation(pid, null, reg));
  }

  var mutation = buildPatientDeleteMutation(pid, hostRow, reg);
  var attempts = await tryVersionedThenCensusDelete(pid, hostRow, reg, mutation);
  if (attempts.ok) return attempts.result;

  return enqueuePatientDeletePatch(pid, hostRow, reg, attempts.httpResult);
}

/** @param {object|null|undefined} hostRow @param {object} snap @param {{ hostOnly?: boolean }} [purgeOpts] */
async function afterHostPatientDelete(hostRow, snap, purgeOpts) {
  invalidateHostPatientsCache();
  if (purgeOpts?.hostOnly || !hostRow) return;
  if (typeof deleteDeps.emitLiveSyncPatientDelete === 'function') {
    deleteDeps.emitLiveSyncPatientDelete(snap);
  }
  if (typeof deleteDeps.scheduleLiveSyncPush === 'function') {
    deleteDeps.scheduleLiveSyncPush();
  }
  await flushLiveSyncOutbox(activeLiveSyncRoomId);
}

async function resolvePurgeHostRow(pid, opts) {
  var registroHint = String(opts.registro || '').trim();
  var fetchHostRow =
    typeof opts.fetchHostRow === 'function'
      ? opts.fetchHostRow
      : deleteDeps.lanFetchHostPatientRow;
  var hostRow = opts.bundleOnly ? null : await fetchHostRow(pid);
  var censusRow = hostRow || (registroHint ? { id: pid, registro: registroHint } : null);
  return { hostRow, censusRow, registroHint };
}

function purgeOwnershipBlocked(opts, censusRow) {
  return (
    !opts.force &&
    censusRow &&
    isHostPatientOwnedByOtherClient(censusRow, getLanClientId())
  );
}

/**
 * Remove a patient chart from the LAN host (admin/orphan cleanup only).
 * @param {string} patientId
 * @param {{ force?: boolean, hostOnly?: boolean, registro?: string, bundleOnly?: boolean, fetchHostRow?: Function, pushDelete?: Function }} [opts]
 */
export async function purgeLanPatientFromHost(patientId, opts) {
  opts = opts || {};
  var pid = String(patientId || '').trim();
  if (!pid || pid.indexOf('demo-') === 0) return { ok: false, error: 'invalid_id' };
  if (!activeLiveSyncRoomId || !isLanSessionConfiguredForRest()) {
    return { ok: false, error: 'not_configured' };
  }
  var resolved = await resolvePurgeHostRow(pid, opts);
  if (purgeOwnershipBlocked(opts, resolved.censusRow)) {
    return { ok: false, error: 'owned_by_other_client', skipped: true };
  }
  var snap = {
    id: pid,
    registro: String((resolved.hostRow && resolved.hostRow.registro) || resolved.registroHint || '').trim(),
  };
  if (!opts.hostOnly) {
    rememberPatientDeleteTombstone(snap);
  }
  var pushDelete =
    typeof opts.pushDelete === 'function' ? opts.pushDelete : pushPatientDeleteToHost;
  var deleteResult = await pushDelete(pid, resolved.hostRow, snap.registro, opts);
  if (!deleteResult?.ok) return deleteResult;
  await afterHostPatientDelete(resolved.hostRow, snap, opts);
  return { ok: true, hadHostRow: !!resolved.hostRow, bundleOnly: !resolved.hostRow };
}
