import { normalizeLabHistoryPatientSets } from './storage-lab.mjs';

/** @param {Record<string, unknown>} obj @param {(key: string, value: unknown) => boolean} keep */
export function filterObjectKeys(obj, keep) {
  const out = {};
  Object.keys(obj || {}).forEach(function (k) {
    if (keep(k, obj[k])) out[k] = obj[k];
  });
  return out;
}

function isNonDemoPatientKey(k) {
  return !k.startsWith('demo-');
}

/** @param {Record<string, string>} notes */
export function buildNotesPersist(notes) {
  return filterObjectKeys(notes, function (k, v) {
    return !!v && isNonDemoPatientKey(k);
  });
}

/** @param {Record<string, string>} indicaciones */
export function buildIndicacionesPersist(indicaciones) {
  return filterObjectKeys(indicaciones, function (k, v) {
    return !!v && isNonDemoPatientKey(k);
  });
}

/** @param {Record<string, unknown>} labHistory */
export function buildLabHistoryPersist(labHistory) {
  const out = {};
  Object.keys(labHistory || {}).forEach(function (k) {
    if (isNonDemoPatientKey(k)) {
      out[k] = normalizeLabHistoryPatientSets(labHistory[k]);
    }
  });
  return out;
}

/** @param {Record<string, unknown> | undefined} map */
export function buildOptionalPatientMapPersist(map) {
  return filterObjectKeys(map || {}, isNonDemoPatientKey);
}

/** @param {Record<string, unknown> | undefined} map */
export function buildListadoPersist(listadoProblemas) {
  return filterObjectKeys(listadoProblemas || {}, function (k, v) {
    return !!v && isNonDemoPatientKey(k);
  });
}

/**
 * @param {object} input
 * @returns {{ dbFields: object, localWrites: [string, string][] }}
 */
export function buildSaveAllPersistPayload(input) {
  const {
    patients,
    notes,
    indicaciones,
    labHistory,
    medRecetaByPatient,
    listadoProblemas,
    recetaHuByPatient,
    vpoByPatient,
    medPharmProfileByPatient,
  } = input;

  const notesPersist = buildNotesPersist(notes);
  const indPersist = buildIndicacionesPersist(indicaciones);
  const lhPersist = buildLabHistoryPersist(labHistory);
  const medPersist = buildOptionalPatientMapPersist(medRecetaByPatient);
  const medPharmPersist = buildOptionalPatientMapPersist(medPharmProfileByPatient);
  const listPersist = buildListadoPersist(listadoProblemas);
  const recetaPersist = buildOptionalPatientMapPersist(recetaHuByPatient);
  const vpoPersist = buildOptionalPatientMapPersist(vpoByPatient);
  const filteredPatients = patients.filter(function (p) {
    return !p.isDemo;
  });

  const dbFields = {
    patients: filteredPatients,
    notes: notesPersist,
    indicaciones: indPersist,
    labHistory: lhPersist,
    medRecetaByPatient: medPersist,
  };

  const writes = [
    ['rpc-patients', JSON.stringify(filteredPatients)],
    ['rpc-notes', JSON.stringify(notesPersist)],
    ['rpc-indicaciones', JSON.stringify(indPersist)],
    ['rpc-labHistory', JSON.stringify(lhPersist)],
    ['rpc-medRecetaByPatient', JSON.stringify(medPersist)],
  ];

  if (medPharmProfileByPatient !== undefined) {
    dbFields.medPharmProfileByPatient = medPharmPersist;
    writes.push(['rpc-medPharmProfileByPatient', JSON.stringify(medPharmPersist)]);
  }
  if (listadoProblemas !== undefined) {
    dbFields.listadoProblemas = listPersist;
    writes.push(['rpc-listado-problemas', JSON.stringify(listPersist)]);
  }
  if (recetaHuByPatient !== undefined) {
    dbFields.recetaHuByPatient = recetaPersist;
    writes.push(['rpc-recetaHuByPatient', JSON.stringify(recetaPersist)]);
  }
  if (vpoByPatient !== undefined) {
    dbFields.vpoByPatient = vpoPersist;
    writes.push(['rpc-vpoByPatient', JSON.stringify(vpoPersist)]);
  }

  return { dbFields, localWrites: writes };
}
