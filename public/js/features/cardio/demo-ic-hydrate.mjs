/**
 * Bundled DEMO IC clinical blob — sync hydrate (no fetch).
 * Source of truth: data/demo-patients/demo-ic-seguimiento.json
 */
import demoIcPayload from '../../../../data/demo-patients/demo-ic-seguimiento.json' with { type: 'json' };

export const DEMO_IC_REGISTRO = 'DEMO-IC-0001';
export const DEMO_IC_NOMBRE = 'Rosa María Delgado Vázquez';

/**
 * @param {unknown} patient
 * @returns {boolean}
 */
export function isDemoIcPatient(patient) {
  if (!patient || typeof patient !== 'object') return false;
  /** @type {any} */
  var p = patient;
  if (String(p.registro || '').trim() === DEMO_IC_REGISTRO) return true;
  var nom = String(p.nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return nom === 'rosa maria delgado vazquez';
}

/**
 * @returns {Record<string, unknown> | null}
 */
export function getBundledDemoIcPatient() {
  var patient = demoIcPayload && demoIcPayload.patient;
  if (!patient || typeof patient !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(patient));
  } catch (_e) {
    return null;
  }
}

/**
 * @param {unknown} cardio
 * @returns {boolean}
 */
export function cardioSegmentsIncomplete(cardio) {
  if (!cardio || typeof cardio !== 'object') return true;
  /** @type {any} */
  var c = cardio;
  var segs = [].concat(c.medSegments || [], c.diureticSegments || []);
  if (!segs.length) return true;
  return segs.some(function (s) {
    if (!s || typeof s !== 'object') return false;
    var tipo = String(s.tipo || '').trim();
    if (!tipo) return false;
    return !String(s.inicio || '').trim() || !String(s.indicacion || '').trim();
  });
}

/**
 * Replace IC clinical fields on a DEMO patient from the bundled fixture.
 * @param {Record<string, unknown>} target
 * @returns {boolean} true if applied
 */
export function hydrateDemoIcPatientFromBundle(target) {
  var src = getBundledDemoIcPatient();
  if (!target || !src) return false;
  var keys = [
    'cardio',
    'historiaClinica',
    'eventualidades',
    'icLabs',
    'fenotipo',
    'etiologia',
    'residente',
    'fimiFecha',
    'diagnosticos',
    'ekg',
    'monitoreo',
    'registro',
    'nombre',
    'edad',
    'sexo',
    'cuarto',
    'cama',
    'area',
    'servicio',
  ];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!(key in src) || src[key] == null) continue;
    try {
      target[key] = JSON.parse(JSON.stringify(src[key]));
    } catch (_e) {
      target[key] = src[key];
    }
  }
  return true;
}
