/** @type {Record<string, string>} localStorage rpc-* key → clinical_blob.blob_key */
export const LS_KEY_TO_BLOB = {
  'rpc-patients': 'patients',
  'rpc-notes': 'notes',
  'rpc-indicaciones': 'indicaciones',
  'rpc-labHistory': 'labHistory',
  'rpc-medRecetaByPatient': 'medRecetaByPatient',
  'rpc-listado-problemas': 'listadoProblemas',
  'rpc-recetaHuByPatient': 'recetaHuByPatient',
  'rpc-vpoByPatient': 'vpoByPatient',
  'rpc-medPharmProfileByPatient': 'medPharmProfileByPatient',
  'rpc-medCatalog': 'medCatalog',
  'rpc-todos': 'todos',
  'rpc-scheduled-procedures': 'scheduledProcedures',
  'rpc-lan-room-snapshots': 'lanRoomSnapshots',
  'rpc-lan-host-patient-map': 'lanHostPatientMap',
};

/** @type {Record<string, string>} clinical_blob.blob_key → localStorage rpc-* key */
export const BLOB_TO_LS_KEY = Object.fromEntries(
  Object.entries(LS_KEY_TO_BLOB).map(([lsKey, blobKey]) => [blobKey, lsKey])
);
