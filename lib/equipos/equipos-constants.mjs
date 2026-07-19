import crypto from 'node:crypto';
import { CLINICAL_SALA_VALUES } from '../clinical-salas.mjs';

export const EQUIPOS_DEVICE_TYPES = ['lumify', 'ekg', 'ultrasound'];

export const EQUIPOS_DEVICE_LABELS = {
  lumify: 'Lumify',
  ekg: 'EKG',
  ultrasound: 'Ultrasonido',
};

/** @param {string} deviceType */
export function normalizeEquiposDeviceType(deviceType) {
  const d = String(deviceType || '').trim().toLowerCase();
  return EQUIPOS_DEVICE_TYPES.includes(d) ? d : '';
}

/** @param {string} rotation */
export function normalizeEquiposRotation(rotation) {
  const r = String(rotation || '').trim();
  return CLINICAL_SALA_VALUES.includes(r) ? r : '';
}

/** @param {string} name */
export function normalizeReporterName(name) {
  const n = String(name || '').trim();
  if (n.length < 2 || n.length > 80) return '';
  return n;
}

/** @param {string} [deviceType] */
export function normalizePurgeTarget(deviceType) {
  const d = String(deviceType || 'all').trim().toLowerCase();
  if (d === 'all') return 'all';
  return normalizeEquiposDeviceType(d) || '';
}

export function newEquiposId() {
  return crypto.randomUUID();
}

/** Admin/history retention — daily cron deletes only rows older than this. */
export const EQUIPOS_PHOTO_RETENTION_DAYS = 14;

/** Server upload cap after client JPEG compression. */
export const EQUIPOS_PHOTO_MAX_BYTES = 1024 * 1024;

/** Mobile upload resize/compress defaults (keep in sync with public/equipos/equipos-api.mjs). */
export const EQUIPOS_PHOTO_UPLOAD_MAX_DIM = 720;
export const EQUIPOS_PHOTO_UPLOAD_JPEG_QUALITY = 0.72;
export const EQUIPOS_PHOTO_UPLOAD_TARGET_B64_LEN = 320_000;

/** @param {number} [nowMs] */
export function equiposPhotoRetentionCutoffIso(nowMs = Date.now()) {
  const ms = EQUIPOS_PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(nowMs - ms).toISOString();
}
