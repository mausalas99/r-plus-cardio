'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveStorageRoot(baseDir) {
  if (baseDir) return baseDir;
  if (process.env.R_PLUS_USER_DATA) return process.env.R_PLUS_USER_DATA;
  return path.join(process.cwd(), 'storage');
}

function archiveDirForPatient(storageRoot, patientId) {
  return path.join(resolveStorageRoot(storageRoot), 'archive', String(patientId || ''));
}

function archiveFilePath(storageRoot, patientId) {
  return path.join(archiveDirForPatient(storageRoot, patientId), 'historia-clinica.json');
}

/**
 * @param {{ storageRoot?: string, patientId: string, payload: object }} opts
 */
function writeHistoriaClinicaArchive(opts) {
  const patientId = String(opts.patientId || '').trim();
  if (!patientId) throw new Error('patientId required');
  const dir = archiveDirForPatient(opts.storageRoot, patientId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = archiveFilePath(opts.storageRoot, patientId);
  const doc = {
    archivedAt: new Date().toISOString(),
    patientId,
    ...opts.payload,
  };
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 0), 'utf8');
  fs.renameSync(tmp, filePath);
  return filePath;
}

/**
 * @param {{ storageRoot?: string, patientId: string }} opts
 */
function readHistoriaClinicaArchive(opts) {
  const filePath = archiveFilePath(opts.storageRoot, opts.patientId);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

module.exports = {
  resolveStorageRoot,
  archiveFilePath,
  writeHistoriaClinicaArchive,
  readHistoriaClinicaArchive,
};
