/**
 * Plantillas de formato clínico en blanco (sin datos identificables del paciente).
 * Estructura reutilizable, similar al listado de problemas vacío para rellenar.
 */

/** Estructura SOAP para nota de evolución — sin contenido clínico concreto. */
export const BLANK_NOTA_EVOLUCION =
  'N: [Neurológico]\n' +
  'V: [Ventilatorio]\n' +
  'HD: [Hemodinámico]\n' +
  'HI: [Infeccioso]\n' +
  'NM: [Nutricional / Metabólico]';

/** Bloques de estudios auxiliares con fechas vacías. */
export const BLANK_NOTA_ESTUDIOS =
  'FECHA (DD/MM/AA)\n' +
  'QS\n' +
  'BH\n' +
  'EGO\n' +
  '\n' +
  'FECHA (DD/MM/AA)\n' +
  'QS\n' +
  'BH';

export const PROFILE_TEMPLATE_DEFAULTS = {
  defaultNotaEvolucion: BLANK_NOTA_EVOLUCION,
  defaultNotaEstudios: BLANK_NOTA_ESTUDIOS,
  defaultDieta: '',
  defaultCuidados: '',
  defaultMedicamentos: '',
  defaultIndicacionesEstudios: '',
  defaultIndicacionesInterconsultas: '',
};

/** Fragmentos de plantillas antiguas con contenido demasiado específico (demo / ejemplos). */
var LEGACY_IDENTIFIABLE_SNIPPETS = [
  'HIPOSÓDICA',
  'HIPOSODICA',
  'PARACETAMOL',
  'CEFEPIME',
  'LOSARTÁN',
  'LOSARTAN',
  'GLUCOMETRÍA C/6',
  'GLUCOMETRIA C/6',
  'INFECTOLOGÍA',
  'INFECTOLOGIA',
  'DIETA NORMAL DIABÉTICA',
  'SONDA FOLEY',
  'MAURICIO',
  'ELEUTERIO',
];

/**
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikeLegacyIdentifiableTemplate(text) {
  var u = String(text || '').toUpperCase();
  if (!u.trim()) return false;
  for (var i = 0; i < LEGACY_IDENTIFIABLE_SNIPPETS.length; i++) {
    if (u.indexOf(LEGACY_IDENTIFIABLE_SNIPPETS[i]) >= 0) return true;
  }
  return false;
}

/**
 * Completa claves de plantilla faltantes (no sobrescribe valores ya guardados).
 * @param {Record<string, unknown>} st
 */
export function ensureProfileTemplateDefaults(st) {
  if (!st || typeof st !== 'object') return;
  Object.keys(PROFILE_TEMPLATE_DEFAULTS).forEach(function (key) {
    if (st[key] == null || st[key] === '') {
      st[key] = PROFILE_TEMPLATE_DEFAULTS[key];
    }
  });
}

/**
 * Restablece todas las plantillas de formato al esquema en blanco.
 * @param {Record<string, unknown>} st
 */
export function resetProfileTemplatesToBlank(st) {
  if (!st || typeof st !== 'object') return;
  Object.assign(st, PROFILE_TEMPLATE_DEFAULTS);
}

/**
 * @param {object|null|undefined} note
 * @param {Record<string, unknown>} settings
 * @returns {boolean}
 */
export function applyNotaFormatScaffoldIfEmpty(note, settings) {
  if (!note) return false;
  var st = settings || {};
  var changed = false;
  if (!String(note.evolucion || '').trim() && st.defaultNotaEvolucion) {
    note.evolucion = String(st.defaultNotaEvolucion);
    changed = true;
  }
  if (!String(note.estudios || '').trim() && st.defaultNotaEstudios) {
    note.estudios = String(st.defaultNotaEstudios);
    changed = true;
  }
  return changed;
}

/**
 * @param {object|null|undefined} ind
 * @param {Record<string, unknown>} settings
 * @returns {boolean}
 */
export function applyIndicacionesFormatScaffoldIfEmpty(ind, settings) {
  if (!ind) return false;
  var st = settings || {};
  var changed = false;
  var map = [
    ['dieta', 'defaultDieta'],
    ['cuidados', 'defaultCuidados'],
    ['medicamentos', 'defaultMedicamentos'],
    ['estudios', 'defaultIndicacionesEstudios'],
    ['interconsultas', 'defaultIndicacionesInterconsultas'],
  ];
  map.forEach(function (pair) {
    var field = pair[0];
    var key = pair[1];
    if (!String(ind[field] || '').trim() && st[key]) {
      ind[field] = String(st[key]);
      changed = true;
    }
  });
  return changed;
}
