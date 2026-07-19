import {
  getProcedureById,
  suggestAhaClinicoFromAsa,
} from './vpo-lookups.mjs';
import {
  parseDiagnosticosText,
  formatDiagnosticosCopy,
} from './patient-diagnosticos.mjs';
import { sortLabHistoryChronological } from './tend-core.mjs';

export const DURACION_OPCIONES = [
  { key: 'le2', label: '≤ 2 horas', hours: 2 },
  { key: '2to3', label: '2–3 horas', hours: 2.5 },
  { key: 'gt3', label: '> 3 horas', hours: 4 },
];

export const DEFAULT_EKG_TEXT =
  'ELECTROCARDIOGRAMA DE 12 DERIVACIONES, RITMO SINUSAL, EJE ELÉCTRICO NORMAL (ENTRE 0 Y 90 GRADOS), FC ___ LPM, ONDA P PRESENTE Y DE MORFOLOGÍA NORMAL, INTERVALO PR CONSERVADO (120-200 MS), COMPLEJO QRS DE DURACIÓN NORMAL (<120 MS), SIN SUPRA O INFRA DESNIVELES DEL SEGMENTO ST, ONDAS T SIMÉTRICAS SIN INVERSIONES, INTERVALO QTC DENTRO DE PARÁMETROS NORMALES. SIN DATOS DE BLOQUEO, HIPERTROFIA, ISQUEMIA O NECROSIS.';

export const DEFAULT_RX_TEXT =
  'RADIOGRAFÍA DE TÓRAX AP, SIN ROTACIÓN, ADECUADA PENETRACIÓN, TEJIDOS BLANDOS SIN ALTERACIONES, MARCO ÓSEO ÍNTEGRO, CAMPOS PULMONARES SIN REDISTRIBUCIÓN DE FLUJO, ÁNGULOS CARDIOFRÉNICOS Y COSTODIAFRAGMÁTICOS LIBRES, ÍNDICE CARDIOTORÁCICO <50% SIN CARDIOMEGALIA, SILUETA MEDIASTINAL NORMAL, TRÁQUEA CENTRAL. SIN INFILTRADOS, DERRAME PLEURAL, CONSOLIDACIONES NI MASAS.';

export function emptyVpoState() {
  return {
    edad: '',
    creatinina: '',
    hemoglobina: '',
    spo2: '',
    duracionCirugiaHoras: '',
    duracionCirugiaKey: '',
    asaKey: '',
    functionalKey: 'independent',
    procedureId: '',
    ahaClinico: '',
    ahaQuirurgico: '',
    ekgText: DEFAULT_EKG_TEXT,
    rxText: DEFAULT_RX_TEXT,
    diagnosticosText: '',
    diagnosticosList: /** @type {string[]} */ ([]),
    diagnosticosTouched: false,
    valoracionIntro: 'SE REALIZA VALORACIÓN PREOPERATORIA. SE OTORGA RIESGO QUIRÚRGICO:',
    scaleResults: {
      asa: '',
      rcri: '',
      gupta: '',
      ariscat: '',
      caprini: '',
    },
    farmacos: [],
    fcLpm: '',
    lastLabApplied: null,
    lastFcApplied: '',
  };
}

/** @param {object} state */
export function ensureScaleResults(state) {
  if (!state) return;
  var defaults = emptyVpoState().scaleResults;
  if (!state.scaleResults || typeof state.scaleResults !== 'object') {
    state.scaleResults = Object.assign({}, defaults);
    return;
  }
  Object.keys(defaults).forEach(function (k) {
    if (state.scaleResults[k] == null) state.scaleResults[k] = '';
  });
}

export function ensureVpoState(map, patientId) {
  if (!patientId) return emptyVpoState();
  if (!map[patientId]) map[patientId] = emptyVpoState();
  ensureDiagnosticosList(map[patientId]);
  ensureScaleResults(map[patientId]);
  return map[patientId];
}

/** @param {object} state */
export function ensureDiagnosticosList(state) {
  if (!state) return;
  if (!Array.isArray(state.diagnosticosList)) state.diagnosticosList = [];
  if (!state.diagnosticosList.length && state.diagnosticosText) {
    state.diagnosticosList = parseDiagnosticosText(state.diagnosticosText);
  }
  if (!state.diagnosticosList.length) state.diagnosticosList = [''];
  state.diagnosticosText = formatDiagnosticosCopy(
    state.diagnosticosList.filter(function (d) {
      return String(d || '').trim();
    })
  );
}

/** @param {object} state @param {string[]} list */
export function setDiagnosticosList(state, list) {
  var cleaned = (list || [])
    .map(function (d) {
      return String(d || '').trim().toUpperCase();
    })
    .filter(Boolean);
  state.diagnosticosList = cleaned.length ? cleaned.concat(['']) : [''];
  state.diagnosticosText = formatDiagnosticosCopy(cleaned);
  syncAhaFields(state);
}

/** @param {object} state @param {string} procedureId */
export function applyProcedureSelection(state, procedureId) {
  var proc = getProcedureById(procedureId);
  state.procedureId = procedureId || '';
  if (!proc) return;
  state.ahaQuirurgico = proc.ahaQuirurgico;
}

/** @param {object} state @param {string} asaKey */
export function applyAsaSuggestion(state, asaKey) {
  state.asaKey = asaKey || '';
  syncAhaFields(state);
}

/** @param {object} state */
export function syncAhaFields(state) {
  if (state.asaKey) {
    state.ahaClinico = suggestAhaClinicoFromAsa(state.asaKey);
  }
  var proc = getProcedureById(state.procedureId);
  if (proc) state.ahaQuirurgico = proc.ahaQuirurgico;
}

/** @param {string} key */
export function duracionKeyToHours(key) {
  var o = DURACION_OPCIONES.find(function (d) {
    return d.key === key;
  });
  return o ? o.hours : null;
}

/** @param {string|number} hours */
export function duracionHoursToKey(hours) {
  var h = typeof hours === 'number' ? hours : parseFloat(String(hours || '').replace(',', '.'));
  if (!Number.isFinite(h)) return '';
  if (h <= 2) return 'le2';
  if (h <= 3) return '2to3';
  return 'gt3';
}

/** @param {object} state */
export function ensureDuracionKey(state) {
  if (state.duracionCirugiaKey) {
    var h = duracionKeyToHours(state.duracionCirugiaKey);
    if (h != null) state.duracionCirugiaHoras = String(h);
    return;
  }
  if (state.duracionCirugiaHoras) {
    state.duracionCirugiaKey = duracionHoursToKey(state.duracionCirugiaHoras);
  }
}

/** @param {object} state @param {string} key */
export function applyDuracionKey(state, key) {
  state.duracionCirugiaKey = key || '';
  var h = duracionKeyToHours(key);
  state.duracionCirugiaHoras = h != null ? String(h) : '';
}

/** @param {unknown} monitoreoLike */
export function getVitalsFromMonitoreo(monitoreoLike) {
  /** @type {any} */
  var m = monitoreoLike || {};
  var hist = Array.isArray(m.historial) ? m.historial.slice() : [];
  hist.sort(function (a, b) {
    var ra = a && typeof a === 'object' && 'recordedAt' in a ? String(/** @type {any} */ (a).recordedAt) : '';
    var rb = b && typeof b === 'object' && 'recordedAt' in b ? String(/** @type {any} */ (b).recordedAt) : '';
    return rb.localeCompare(ra);
  });

  function pick(key) {
    for (var i = 0; i < hist.length; i++) {
      var row = hist[i];
      if (!row || typeof row !== 'object') continue;
      var rv =
        /** @type {any} */ (row).vitals && typeof /** @type {any} */ (row).vitals === 'object'
          ? /** @type {any} */ (row).vitals
          : {};
      var val = rv[key];
      if (val != null && val !== '') return String(val).trim();
    }
    return '';
  }

  return { fc: pick('fc'), sat: pick('sat') };
}

/** @param {object} state @param {object|null} patient */
export function applyVitalsFromMonitoreo(state, patient) {
  if (!patient || !patient.monitoreo) return false;
  var v = getVitalsFromMonitoreo(patient.monitoreo);
  var ok = false;
  if (v.fc) {
    state.fcLpm = v.fc;
    state.lastFcApplied = v.fc;
    ok = true;
  }
  if (v.sat) {
    state.spo2 = v.sat;
    ok = true;
  }
  return ok;
}

/**
 * @param {object} state
 * @param {Array<{ id: string, nombreRaw: string, suspendido?: boolean }>} medItems
 */
export function mergeFarmacosFromMedReceta(state, medItems) {
  if (!state.farmacos) state.farmacos = [];
  var existing = new Set(state.farmacos.map((f) => f.sourceMedId).filter(Boolean));
  (medItems || []).forEach(function (it) {
    if (!it || it.suspendido) return;
    if (existing.has(it.id)) return;
    state.farmacos.push({
      sourceMedId: it.id,
      nombreDisplay: it.nombreRaw || '',
      sugerencia: '',
      notaEditable: '',
      addedAt: new Date().toISOString(),
    });
    existing.add(it.id);
  });
}

/** @param {object} state @param {string[]} notaDx */
export function importDiagnosticosFromNota(state, notaDx) {
  var lines = (notaDx || [])
    .map(function (d) {
      return String(d || '').trim().toUpperCase();
    })
    .filter(Boolean);
  if (!lines.length) return false;
  setDiagnosticosList(state, lines);
  state.diagnosticosTouched = true;
  return true;
}

/** @param {object} state @param {string} pasteText */
export function importDiagnosticosFromPaste(state, pasteText) {
  var parsed = parseDiagnosticosText(pasteText);
  if (!parsed.length) return false;
  setDiagnosticosList(state, parsed);
  state.diagnosticosTouched = true;
  return true;
}

/** @param {Array<object>|undefined} labHistoryPatient @param {object|null} _patient */
export function getLatestLabValues(labHistoryPatient, _patient) {
  var hist = Array.isArray(labHistoryPatient) ? labHistoryPatient : [];
  var latest = sortLabHistoryChronological(hist)[0] || null;
  if (!latest) return null;
  var pb = latest.parsedBySection || {};
  var flat = latest.parsed || {};
  function pick(key) {
    if (pb.QS && pb.QS[key] != null) return pb.QS[key];
    if (flat[key] != null) return flat[key];
    return null;
  }
  var hb = pick('Hb') != null ? pick('Hb') : pick('Hemoglobina');
  return {
    fecha: latest.fecha || '',
    creatinina: pick('Cr'),
    hemoglobina: hb,
  };
}

/** @param {object} state @param {{ creatinina?: *, hemoglobina?: *, fecha?: string }} vals */
export function applyLabValues(state, vals) {
  if (vals.creatinina != null && vals.creatinina !== '') state.creatinina = String(vals.creatinina);
  if (vals.hemoglobina != null && vals.hemoglobina !== '') state.hemoglobina = String(vals.hemoglobina);
  state.lastLabApplied = { fecha: vals.fecha || '', creatinina: state.creatinina, hemoglobina: state.hemoglobina };
}

/** @param {object} state @param {object|null} patient */
export function autofillVitalsFromMonitoreoIfEmpty(state, patient) {
  if (!patient || !patient.monitoreo) return;
  var v = getVitalsFromMonitoreo(patient.monitoreo);
  if (!String(state.spo2 || '').trim() && v.sat) state.spo2 = v.sat;
  if (!String(state.fcLpm || '').trim() && v.fc) {
    state.fcLpm = v.fc;
    state.lastFcApplied = v.fc;
  }
}
