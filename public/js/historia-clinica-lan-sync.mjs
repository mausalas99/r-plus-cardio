import { patients, saveState } from './app-state.mjs';
import { createMutationBuilder, createDeltaMutationBuilder } from './versioned-mutation.mjs';
import { migrateLegacyHistoriaData } from '../../lib/historia-clinica/migrate-legacy.mjs';
import appConditions from '../../lib/historia-clinica/catalogs/app-conditions.json' with { type: 'json' };
import ahfConditions from '../../lib/historia-clinica/catalogs/ahf-conditions.json' with { type: 'json' };
import ipasSystems from '../../lib/historia-clinica/catalogs/ipas-systems.json' with { type: 'json' };
import {
  lanPushHistoriaClinica,
  lanPushHistoriaClinicaDelta,
  getActiveLiveSyncRoomId,
  isLanSessionConfiguredForRest,
} from './features/lan-sync.mjs';

const CATALOGS = { appConditions, ahfConditions, ipasSystems };

const HC_SYNC_KEYS = [
  'identificacion',
  'motivoConsulta',
  'apnp',
  'app',
  'ahf',
  'genero',
  'sexual',
  'padecimientoActual',
  'datosNegados',
  'ipas',
  'signosVitalesIngreso',
  'labsAtAdmission',
  'labAnchor',
  'meta',
  'labLookbackHours',
];

const HC_DELTA_SAFE_PATHS = new Set([
  'labsAtAdmission.na',
  'labsAtAdmission.k',
  'labsAtAdmission.cr',
  'labsAtAdmission.hb',
  'signosVitalesIngreso.fc',
  'signosVitalesIngreso.ta',
  'signosVitalesIngreso.fr',
  'signosVitalesIngreso.temp',
  'motivoConsulta',
  'padecimientoActual',
  'plan',
]);

function readPathValue(root, path) {
  return String(path || '').split('.').reduce(function (cur, part) {
    return cur && typeof cur === 'object' ? cur[part] : undefined;
  }, root);
}

/**
 * @param {object} patient
 * @param {{ changedPaths?: string[], clientId?: string, roomId?: string, nowMs?: () => number }} [opts]
 */
export function buildHistoriaClinicaDelta(patient, opts) {
  opts = opts || {};
  if (!patient || !patient.historiaClinica || !patient.historiaClinica.data) return null;
  const changedPaths = Array.isArray(opts.changedPaths) ? opts.changedPaths : [];
  if (!changedPaths.length) return null;
  if (changedPaths.some((path) => !HC_DELTA_SAFE_PATHS.has(String(path)))) return null;
  const nowMs = typeof opts.nowMs === 'function' ? opts.nowMs : Date.now;
  const builder = createDeltaMutationBuilder('historiaClinica', patient.id);
  changedPaths.forEach(function (path) {
    const value = readPathValue(patient.historiaClinica.data, path);
    builder.setPath(path, value === undefined ? null : value, nowMs());
  });
  return builder.build({
    roomId: opts.roomId,
    patientId: patient.id,
    clientId: opts.clientId || localStorage.getItem('rpc-lan-client-id') || 'local',
    expectedVersion: Number(patient.historiaClinica.version || 0),
  });
}

/** @type {Map<string, Promise<unknown>>} */
const _inFlight = new Map();

/**
 * @param {object} patient
 * @param {{ expectedVersion: number, baseData: object, changedKeys: string[], source?: string }} pending
 */
export function markHistoriaPendingLanSync(patient, pending) {
  if (!patient) return;
  if (!patient.historiaClinica) patient.historiaClinica = { version: 0, data: {} };
  patient.historiaClinica.pendingLanSync = true;
  patient.historiaClinica.lanSyncPending = {
    expectedVersion: Number(pending.expectedVersion || 0),
    baseData: pending.baseData,
    changedKeys: (pending.changedKeys || []).slice(),
    source: pending.source ? String(pending.source) : 'pending-lan-sync',
  };
}

/**
 * @param {object} patient
 * @returns {Promise<{ ok: boolean, skipped?: boolean, deferred?: boolean, conflict?: boolean }>}
 */
function resolvePendingChangedKeys(hc, snap) {
  if (snap && snap.changedKeys && snap.changedKeys.length) {
    return snap.changedKeys.slice();
  }
  return HC_SYNC_KEYS.filter(function (k) {
    return hc.data && hc.data[k] !== undefined;
  });
}

function clearPendingLanSync(hc) {
  delete hc.pendingLanSync;
  delete hc.lanSyncPending;
}

/** @param {object} patient @param {string[]} changedKeys @param {string} roomId @param {object} hc */
async function tryDeltaHistoriaPush(patient, changedKeys, roomId, hc) {
  const delta = buildHistoriaClinicaDelta(patient, {
    changedPaths: changedKeys,
    roomId,
    clientId: localStorage.getItem('rpc-lan-client-id') || 'local',
  });
  if (!delta) return null;
  const out = await lanPushHistoriaClinicaDelta(patient.id, delta);
  if (!out || !out.ok) return null;
  hc.version = out.version || hc.version;
  clearPendingLanSync(hc);
  saveState();
  return { ok: true };
}

function buildFullHistoriaMutation(patient, changedKeys, roomId, hc, snap) {
  const expectedVersion =
    snap && snap.expectedVersion != null ? Number(snap.expectedVersion) : Math.max(0, Number(hc.version || 1) - 1);
  const baseData =
    snap && snap.baseData != null ? snap.baseData : expectedVersion > 0 ? {} : {};
  const builder = createMutationBuilder('historiaClinica', patient.id).captureBase({
    version: expectedVersion,
    data: baseData,
  });
  changedKeys.forEach(function (k) {
    if (hc.data[k] !== undefined) builder.set(k, hc.data[k]);
  });
  return builder.build({
    roomId,
    patientId: patient.id,
    clientId: localStorage.getItem('rpc-lan-client-id') || 'local',
    audit: {
      sections: changedKeys,
      source: snap && snap.source ? snap.source : 'pending-lan-sync',
    },
  });
}

/** @param {object} patient @param {object} out @param {object} hc */
function applyHistoriaPushConflict(patient, out, hc) {
  const body = out.body && typeof out.body === 'object' ? out.body : {};
  if (body.serverVersion != null || body.serverData) {
    applyServerHistoriaClinicaToPatient(
      patient,
      body.serverVersion != null ? body.serverVersion : hc.version,
      body.serverData || hc.data
    );
    return;
  }
  clearPendingLanSync(hc);
  saveState();
}

/** @param {object} patient @param {string[]} changedKeys @param {string} roomId @param {object} hc @param {object|null|undefined} snap */
async function tryFullHistoriaPush(patient, changedKeys, roomId, hc, snap) {
  const mutation = buildFullHistoriaMutation(patient, changedKeys, roomId, hc, snap);
  const out = await lanPushHistoriaClinica(patient.id, mutation);
  if (out && out.conflict) {
    applyHistoriaPushConflict(patient, out, hc);
    return { ok: false, conflict: true, deferred: true };
  }
  if (out && out.ok) {
    hc.version = out.version;
    hc.data = migrateLegacyHistoriaData(out.data, CATALOGS);
    clearPendingLanSync(hc);
    saveState();
    return { ok: true };
  }
  return null;
}

export async function flushPendingHistoriaClinicaLanSync(patient) {
  if (!patient || !patient.historiaClinica || !patient.historiaClinica.pendingLanSync) {
    return { ok: true, skipped: true };
  }
  const roomId = getActiveLiveSyncRoomId() || '';
  if (!isLanSessionConfiguredForRest() || !roomId) {
    return { ok: false, deferred: true };
  }

  const hc = patient.historiaClinica;
  const snap = hc.lanSyncPending;
  const changedKeys = resolvePendingChangedKeys(hc, snap);
  if (!changedKeys.length) {
    clearPendingLanSync(hc);
    return { ok: true, skipped: true };
  }

  try {
    const deltaOut = await tryDeltaHistoriaPush(patient, changedKeys, roomId, hc);
    if (deltaOut) return deltaOut;
    const fullOut = await tryFullHistoriaPush(patient, changedKeys, roomId, hc, snap);
    if (fullOut) return fullOut;
  } catch {
    /* host unreachable — keep pending */
  }
  return { ok: false, deferred: true };
}

/** @param {object} patient */
export function schedulePendingHistoriaClinicaLanSync(patient) {
  const id = String(patient && patient.id ? patient.id : '').trim();
  if (!id || !patient.historiaClinica || !patient.historiaClinica.pendingLanSync) return;
  if (_inFlight.has(id)) return;

  const run = flushPendingHistoriaClinicaLanSync(patient).finally(function () {
    _inFlight.delete(id);
    const p = patients.find(function (x) {
      return x.id === id;
    });
    if (p && p.historiaClinica && p.historiaClinica.pendingLanSync) {
      schedulePendingHistoriaClinicaLanSync(p);
    }
  });
  _inFlight.set(id, run);
}

export async function flushAllPendingHistoriaClinicaLanSync() {
  if (!isLanSessionConfiguredForRest() || !getActiveLiveSyncRoomId()) return;
  const pending = patients.filter(function (p) {
    return p.historiaClinica && p.historiaClinica.pendingLanSync;
  });
  for (let i = 0; i < pending.length; i += 1) {
    await flushPendingHistoriaClinicaLanSync(pending[i]);
  }
}

export function scheduleFlushAllPendingHistoriaClinicaLanSync() {
  void flushAllPendingHistoriaClinicaLanSync();
}

/**
 * Aplica copia del host y detiene reintentos de sync pendiente.
 * @param {object} patient
 * @param {number} serverVersion
 * @param {object} serverData
 */
export function applyServerHistoriaClinicaToPatient(patient, serverVersion, serverData) {
  if (!patient) return;
  if (!patient.historiaClinica) patient.historiaClinica = { version: 0, data: {} };
  const hc = patient.historiaClinica;
  hc.version = Number(serverVersion != null ? serverVersion : hc.version || 0);
  if (serverData && typeof serverData === 'object') {
    hc.data = migrateLegacyHistoriaData(serverData, CATALOGS);
  }
  delete hc.pendingLanSync;
  delete hc.lanSyncPending;
  saveState();
}
