/**
 * Export patients (+ clinical sidecars) from SQLCipher to r-plus-range-export JSON.
 * Used by main.js (R_PLUS_RECOVER_CENSUS=1) and IPC db:recover-census-range-export.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getBlob } from '../lib/db/clinical-blobs.mjs';
import { LS_KEY_TO_BLOB } from '../lib/db/clinical-blob-keys.mjs';

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function rememberPatient(map, patient) {
  if (!patient || !patient.id || String(patient.id).indexOf('demo-') === 0) return;
  const id = String(patient.id);
  const prev = map.get(id);
  if (!prev || JSON.stringify(patient).length > JSON.stringify(prev).length) {
    map.set(id, patient);
  }
}

/** @param {Map<string, object>} map @param {Record<string, string|null>} blobs */
function collectPatientsFromBlobs(map, blobs) {
  const census = parseJson(blobs.patients, []);
  if (Array.isArray(census)) {
    for (const p of census) rememberPatient(map, p);
  }

  const snaps = parseJson(blobs.lanRoomSnapshots, {});
  if (snaps && typeof snaps === 'object') {
    for (const snap of Object.values(snaps)) {
      const entries = snap && Array.isArray(snap.entries) ? snap.entries : [];
      for (const ent of entries) {
        if (ent && ent.patient) rememberPatient(map, ent.patient);
      }
    }
  }

  const notes = parseJson(blobs.notes, {});
  const indicaciones = parseJson(blobs.indicaciones, {});
  const labHistory = parseJson(blobs.labHistory, {});
  const ids = new Set([
    ...Object.keys(notes || {}),
    ...Object.keys(indicaciones || {}),
    ...Object.keys(labHistory || {}),
  ]);
  for (const id of ids) {
    if (map.has(id)) continue;
    rememberPatient(map, { id, nombre: 'Recuperado ' + id.slice(0, 8) });
  }
}

function entryFromPatient(patient, blobs) {
  const pid = String(patient?.id || '').trim();
  if (!pid) return null;
  const notes = parseJson(blobs.notes, {});
  const indicaciones = parseJson(blobs.indicaciones, {});
  const labHistory = parseJson(blobs.labHistory, {});
  const medReceta = parseJson(blobs.medRecetaByPatient, {});
  const medPharmProfile = parseJson(blobs.medPharmProfileByPatient, {});
  return {
    patient,
    note: notes[pid] || {},
    indicaciones: indicaciones[pid] || {},
    labHistory: Array.isArray(labHistory[pid]) ? labHistory[pid] : [],
    medReceta: medReceta[pid] || null,
    medPharmProfile: medPharmProfile[pid] || null,
  };
}

/**
 * @param {ReturnType<import('../lib/db/db-manager.mjs').createDbManager>} dbManager
 */
export async function buildRecoverCensusRangePayload(dbManager) {
  if (!dbManager.isUnlocked()) {
    throw new Error('Base cifrada bloqueada.');
  }

  const snapshot = await dbManager.withTransaction((db) => {
    const blobs = {};
    for (const blobKey of Object.values(LS_KEY_TO_BLOB)) {
      blobs[blobKey] = getBlob(db, blobKey);
    }
    const map = new Map();
    collectPatientsFromBlobs(map, blobs);
    return { patients: Array.from(map.values()), blobs };
  });

  const patients = snapshot.patients || [];
  if (!patients.length) {
    throw new Error(
      'No hay pacientes en la base local. Prueba otro Mac del turno o un archivo R-plus-pacientes-*.json.'
    );
  }

  const entries = patients.map((p) => entryFromPatient(p, snapshot.blobs)).filter(Boolean);
  return {
    format: 'r-plus-range-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    from: 'recover-census-export',
    to: String(entries.length) + ' pacientes',
    entries,
  };
}

/** @param {{ app: import('electron').App, dbManager: import('../lib/db/db-manager.mjs').createDbManager extends (...args: any) => infer R ? R : never }} deps */
export async function runRecoverCensusExport(deps) {
  const payload = await buildRecoverCensusRangePayload(deps.dbManager);
  const slug = new Date().toISOString().slice(0, 10);
  const outPath = path.join(
    deps.app.getPath('downloads'),
    'R-plus-recuperacion-censo-' + slug + '.json'
  );
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log('[recover] Exportados', payload.entries.length, 'paciente(s) →', outPath);
  console.log('[recover] En R+: Ajustes → Importar rango… → selecciona ese archivo.');
  return { ok: true, count: payload.entries.length, path: outPath };
}
