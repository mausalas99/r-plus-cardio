/** Merge LAN host bundle entries into r-plus-backup data; normalize purge-ghosts exports. */

const PURGE_GHOSTS_FORMAT = 'r-plus-purge-ghosts-backup';

function collectHostBundleEntries(bundleEntriesByRoom) {
  const out = [];
  const seen = new Set();
  for (const entries of Object.values(bundleEntriesByRoom || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const pid = String(entry?.patient?.id || '').trim();
      if (!pid || pid.indexOf('demo-') === 0 || seen.has(pid)) continue;
      seen.add(pid);
      out.push(entry);
    }
  }
  return out;
}

function patientPresenceIndex(patients) {
  const byId = new Set();
  const byRegistro = new Set();
  for (const p of patients || []) {
    if (!p?.id) continue;
    byId.add(String(p.id));
    const reg = String(p.registro || '').trim();
    if (reg) byRegistro.add(reg);
  }
  return { byId, byRegistro };
}

function isPatientAlreadyPresent(patient, index) {
  const id = String(patient?.id || '').trim();
  const reg = String(patient?.registro || '').trim();
  if (id && index.byId.has(id)) return true;
  return !!(reg && index.byRegistro.has(reg));
}

function cloneObjectMap(value) {
  return value && typeof value === 'object' ? { ...value } : {};
}

function cloneBackupDataMaps(data) {
  return {
    patients: Array.isArray(data.patients) ? data.patients.slice() : [],
    notes: cloneObjectMap(data.notes),
    indicaciones: cloneObjectMap(data.indicaciones),
    labHistory: cloneObjectMap(data.labHistory),
    medRecetaByPatient: cloneObjectMap(data.medRecetaByPatient),
    medPharmProfileByPatient: cloneObjectMap(data.medPharmProfileByPatient),
    listadoProblemas: cloneObjectMap(data.listadoProblemas),
    scheduledProcedures: Array.isArray(data.scheduledProcedures) ? data.scheduledProcedures.slice() : [],
    settings: cloneObjectMap(data.settings),
    medCatalog: cloneObjectMap(data.medCatalog),
  };
}

/**
 * Add host-only bundle charts into backup data (ghost recovery).
 * @param {object} data
 * @param {Record<string, object[]>} bundleEntriesByRoom
 */
export function mergeHostBundleEntriesIntoBackupData(data, bundleEntriesByRoom) {
  if (!data || typeof data !== 'object') return data;
  const merged = cloneBackupDataMaps(data);
  const index = patientPresenceIndex(merged.patients);
  for (const entry of collectHostBundleEntries(bundleEntriesByRoom)) {
    const patient = entry.patient;
    if (!patient?.id || isPatientAlreadyPresent(patient, index)) continue;
    const pid = String(patient.id);
    merged.patients.push(patient);
    index.byId.add(pid);
    const reg = String(patient.registro || '').trim();
    if (reg) index.byRegistro.add(reg);
    if (entry.note) merged.notes[pid] = entry.note;
    if (entry.indicaciones) merged.indicaciones[pid] = entry.indicaciones;
    if (Array.isArray(entry.labHistory)) merged.labHistory[pid] = entry.labHistory;
    if (entry.medReceta) merged.medRecetaByPatient[pid] = entry.medReceta;
    if (entry.medPharmProfile) merged.medPharmProfileByPatient[pid] = entry.medPharmProfile;
    if (entry.listadoProblemas) merged.listadoProblemas[pid] = entry.listadoProblemas;
  }
  return merged;
}

/**
 * Accept standard backups and legacy purge-ghosts wrappers for «Importar copia de seguridad…».
 * @param {unknown} raw
 * @returns {object|null}
 */
export function normalizeFullBackupImportPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.format === 'r-plus-backup' && raw.version === 1 && raw.data) {
    return raw;
  }
  if (raw.format !== PURGE_GHOSTS_FORMAT || raw.version !== 1 || !raw.local) {
    return null;
  }
  const local = raw.local;
  if (local.format !== 'r-plus-backup' || local.version !== 1 || !local.data) {
    return null;
  }
  const bundles = raw.host?.bundleEntriesByRoom || {};
  return {
    ...local,
    exportedAt: raw.exportedAt || local.exportedAt,
    data: mergeHostBundleEntriesIntoBackupData(local.data, bundles),
  };
}
