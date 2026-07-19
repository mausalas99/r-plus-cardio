/**
 * Historia clínica LAN push/fetch helpers.
 */
import { activeLiveSyncRoomId } from './runtime.mjs';
import { isLanSessionConfiguredForRest, lanFetchAuthed } from './transport.mjs';
import { notifyLwwOverwrite } from '../../lan-lww-toast.mjs';

/** @type {{ runtime?: { showToast?: Function }, lanPushPatientVersioned?: Function }} */
let historiaDeps = {};

export function configureLanHistoriaSync(deps) {
  if (deps && typeof deps === 'object') Object.assign(historiaDeps, deps);
}

export async function lanPushHistoriaClinica(patientId, mutation) {
  var pid = String(patientId || '').trim();
  if (!pid || !mutation) return { ok: false, error: 'invalid_args' };
  var resp = await lanFetchAuthed(
    '/api/lan/v1/patients/' + encodeURIComponent(pid) + '/historia-clinica',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mutation),
    }
  );
  if (!resp.ok) {
    return { ok: false, status: resp.status };
  }
  var out = {};
  try {
    out = await resp.json();
  } catch { /* ignored */ }
  if (out && out.lwwApplied && historiaDeps.runtime) {
    notifyLwwOverwrite(historiaDeps.runtime, {
      entityType: 'historiaClinica',
      entityId: pid,
      overwrittenKeys: out.overwrittenKeys || [],
    });
  }
  return { ok: true, version: out.version, data: out.data, body: out };
}

export async function lanPushHistoriaClinicaDelta(patientId, delta) {
  const pid = String(patientId || '').trim();
  if (!pid || !delta || !activeLiveSyncRoomId) return { ok: false, error: 'invalid_args' };
  const resp = await lanFetchAuthed(
    '/api/lan/v1/rooms/' + encodeURIComponent(activeLiveSyncRoomId) + '/delta',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...delta,
        entityType: 'historiaClinica',
        entityId: pid,
        patientId: pid,
      }),
    }
  );
  const body = await resp.json().catch(function () {
    return {};
  });
  if (resp.ok) return { ok: true, version: body.version, body };
  if (resp.status === 409) return { ok: false, stale: true, body };
  return { ok: false, status: resp.status, body };
}

/** Sync patient.archived to LAN host (triggers historia archive when archived: true). */
export async function lanSyncPatientArchivedFlag(patient) {
  if (!patient || !patient.id || !isLanSessionConfiguredForRest()) {
    return { ok: false, error: 'not_configured' };
  }
  var resp = await lanFetchAuthed('/api/lan/v1/patients');
  if (!resp.ok) return { ok: false, status: resp.status };
  var body = {};
  try {
    body = await resp.json();
  } catch { /* ignored */ }
  var list = Array.isArray(body.patients) ? body.patients : [];
  var hostRow = list.find(function (row) {
    return row && String(row.id) === String(patient.id);
  });
  if (!hostRow) return { ok: false, error: 'patient_not_on_host' };
  var mutation = {
    expectedVersion: Number(hostRow.version || 1),
    changedKeys: ['archived'],
    baseData: hostRow,
    data: Object.assign({}, hostRow, { archived: !!patient.archived }),
  };
  var pushVersioned = historiaDeps.lanPushPatientVersioned;
  if (typeof pushVersioned !== 'function') {
    return { ok: false, error: 'not_configured' };
  }
  return pushVersioned(patient.id, mutation);
}

export async function lanFetchHistoriaClinica(patientId, roomId) {
  var pid = String(patientId || '').trim();
  var rid = String(roomId || '').trim();
  if (!pid || !rid || !isLanSessionConfiguredForRest()) {
    return { ok: false, error: 'not_configured' };
  }
  var resp = await lanFetchAuthed(
    '/api/lan/v1/patients/' +
      encodeURIComponent(pid) +
      '/historia-clinica?roomId=' +
      encodeURIComponent(rid)
  );
  if (resp.status === 404) return { ok: true, missing: true };
  if (!resp.ok) return { ok: false, status: resp.status };
  var body = await resp.json();
  return { ok: true, version: body.version, data: body.data };
}
