import crypto from 'node:crypto';
import { appendMedicion, medicionHasCoreData } from '../../public/js/features/estado-actual-data.mjs';
import {
  GLU_RANGE,
  buildAlteredAtDefaults,
  isGluAltered,
} from '../../public/js/features/estado-actual-ranges.mjs';

export { GLU_RANGE, isGluAltered };

/** @param {Array<{ value?: unknown, time?: string }>|undefined} raw */
function normalizeInternoGlucometrias(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => ({
      value: g?.value != null && g.value !== '' ? Number(g.value) : null,
      time: g?.time ? String(g.time) : '',
    }))
    .filter((g) => g.value != null && Number.isFinite(g.value));
}

/** @param {Record<string, string>} alteredAt @param {Array<{ value: number, time: string }>} glucometrias @param {string} timeLabel */
function applyGluAlteredAt(alteredAt, glucometrias, timeLabel) {
  for (const g of glucometrias) {
    if (isGluAltered(g.value)) {
      alteredAt.glu = g.time || timeLabel;
      break;
    }
  }
}

/** @param {{ reporterName?: string, sala?: string }} payload */
function buildInternoRecordedBy(payload) {
  const sala = String(payload?.sala || '').trim();
  const name = String(payload?.reporterName || '').trim();
  return {
    kind: 'interno',
    sala: sala || undefined,
    name: name || (sala ? `Interno ${sala}` : 'Interno'),
  };
}

/**
 * @param {{
 *   vitals?: Record<string, unknown>,
 *   glucometrias?: Array<{ value?: unknown, time?: string }>,
 *   reporterName?: string,
 *   sala?: string,
 * }} payload
 */
export function buildInternoMedicion(payload) {
  const vitals = payload?.vitals && typeof payload.vitals === 'object' ? payload.vitals : {};
  const glucometrias = normalizeInternoGlucometrias(payload?.glucometrias);

  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const alteredAt = buildAlteredAtDefaults(vitals, timeLabel);
  applyGluAlteredAt(alteredAt, glucometrias, timeLabel);

  /** @type {import('../../public/js/features/estado-actual-data.mjs').MedicionHistorial} */
  const medicion = {
    id: crypto.randomUUID(),
    recordedAt: now.toISOString(),
    vitals,
    glucometrias,
    alteredAt,
    recordedBy: buildInternoRecordedBy(payload),
  };

  if (!medicionHasCoreData(medicion)) {
    return { ok: false, error: 'empty' };
  }

  return { ok: true, medicion, hasAlterations: Object.keys(alteredAt).length > 0 };
}

/**
 * @param {object} patient
 * @param {object} medicion
 */
export function applyInternoMedicionToPatient(patient, medicion) {
  const result = appendMedicion(patient, medicion);
  if (!result.ok) return result;
  if (!patient.monitoreo) patient.monitoreo = { historial: [] };
  return { ok: true, patient };
}
