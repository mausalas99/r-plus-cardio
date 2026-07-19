import ahfConditions from '../historia-clinica/catalogs/ahf-conditions.json' with { type: 'json' };
import toxicomaniasSubstances from '../historia-clinica/catalogs/toxicomanias-substances.json' with { type: 'json' };
import { APP_DEDICATED_IDS } from '../historia-clinica/normalize-app.mjs';
import { AHF_RELATIVES } from '../historia-clinica/ahf-relatives.mjs';


const NEGADO_RE = /^(?:INTERROGADO\s+Y\s+)?NEGAD/i;

/** @type {Record<string, RegExp[]>} */
const CONDITION_PATTERNS = {
  diabetes: [/\bDIABET(?:ES|IC[OA])\b/i, /\bDM\s*[12]\b/i, /\bDM2\b/i, /\bDM1\b/i],
  hipertension: [/\bHIPERTENS(?:I[ÓO]N|O)\b/i, /\bHTA\b/i, /\bHAS\b/i],
  enfermedadRenal: [
    /\bENFERMEDAD\s+RENAL\b/i,
    /\bERC\b/i,
    /\bIRC\b/i,
    /\bINSUFICIENCIA\s+RENAL\b/i,
    /\bNEFROPAT/i,
    /\bRI[ÑN]ON\s+POLIQU/i,
  ],
  cardiopatia: [/\bCARDIOPAT/i, /\bINSUFICIENCIA\s+CARD[IÍ]ACA\b/i, /\bICC\b/i, /\bFEVI\b/i],
  enfermedadPulmonar: [/\bEPOC\b/i, /\bENFERMEDAD\s+PULMONAR\b/i],
  cancer: [/\bNEOPLASIA\b/i, /\bC[AÁ]NCER\b/i, /\bCA\s+DE\b/i, /\bTUMOR\b/i],
  vih: [/\bVIH\b/i, /\bSIDA\b/i, /\bHIV\b/i],
  tuberculosis: [/\bTUBERCULOSIS\b/i, /\bTBC\b/i],
  hepatitis: [/\bHEPATITIS\b/i],
  parotiditis: [/\bPAROTIDITIS\b/i],
  paperas: [/\bPAPERAS\b/i],
  sarampion: [/\bSARAMPI[ÓO]N\b/i],
  varicela: [/\bVARICELA\b/i],
  rubeola: [/\bRUB[ÉE]OLA\b/i],
  neoplasia: [/\bNEOPLASIA\b/i],
  epilepsia: [/\bEPILEPS/i, /\bCONVULS/i],
  psiquiatrico: [/\bPSIQUIATR/i, /\bDEPRESI[ÓO]N\b/i, /\bESQUIZOFREN/i],
  tiroideo: [/\bTIROIDE/i, /\bHIPOTIRO/i, /\bHIPERTIRO/i],
};

/** @type {Array<{ key: string, re: RegExp }>} */
export const APP_SUBSECTION_HEADERS = [
  { key: 'ecd', re: /^ENFERMEDADES\s+CR[ÓO]NICO-?DEGENERATIVAS\s*:?\s*(.*)$/i },
  { key: 'medicamentos', re: /^MEDICAMENTOS(?:\s+ACTUALES|\s+HABITUALES)?\s*:?\s*(.*)$/i },
  { key: 'transfusiones', re: /^TRANSFUSIONES\s*:?\s*(.*)$/i },
  { key: 'hospitalizaciones', re: /^HOSPITALIZACIONES\s*:?\s*(.*)$/i },
  { key: 'cirugias', re: /^CIRUG[ÍI]AS(?:\s+PREVIAS)?\s*:?\s*(.*)$/i },
  { key: 'traumaticos', re: /^(?:TRAUMATISMOS?|FRACTURAS?)\s*:?\s*(.*)$/i },
  { key: 'inmunizaciones', re: /^INMUNIZACIONES\s*:?\s*(.*)$/i },
  { key: 'alergias', re: /^ALERGIAS(?:\s+MEDICAMENTOSAS)?\s*:?\s*(.*)$/i },
  { key: 'enfermedades', re: /^ENFERMEDADES\s*:?\s*(.*)$/i },
];

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isNegatedDriveText(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  return NEGADO_RE.test(t);
}

/**
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseAppSubsections(text) {
  /** @type {Record<string, string>} */
  const out = {};
  const lines = String(text || '').split('\n');
  let currentKey = '_body';
  /** @type {string[]} */
  let currentLines = [];

  function flush() {
    const body = currentLines.join('\n').trim();
    if (body) out[currentKey] = out[currentKey] ? out[currentKey] + '\n' + body : body;
    currentLines = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    let matched = false;
    for (const header of APP_SUBSECTION_HEADERS) {
      const hit = header.re.exec(line);
      if (hit) {
        flush();
        currentKey = header.key;
        matched = true;
        if (hit[1] && hit[1].trim()) currentLines.push(hit[1].trim());
        break;
      }
    }
    if (!matched) currentLines.push(raw);
  }
  flush();
  return out;
}

/**
 * @param {string} text
 * @param {Record<string, string>} catalog
 * @returns {Array<{ id: string, label: string }>}
 */
export function matchCatalogConditions(text, catalog) {
  const hay = String(text || '');
  if (!hay.trim() || isNegatedDriveText(hay)) return [];
  /** @type {Array<{ id: string, label: string }>} */
  const hits = [];
  const seen = new Set();

  Object.keys(catalog || {}).forEach(function (id) {
    if (APP_DEDICATED_IDS.has(id)) return;
    if (id === 'otro') return;
    const label = catalog[id];
    const patterns = CONDITION_PATTERNS[id] || [];
    const labelRe = new RegExp('\\b' + String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    const matched =
      patterns.some(function (re) {
        return re.test(hay);
      }) || labelRe.test(hay);
    if (matched && !seen.has(id)) {
      seen.add(id);
      hits.push({ id, label });
    }
  });
  return hits;
}

/**
 * @param {string} text
 * @returns {Array<{ id: string, medication: string, route: string, dosage: string, frequency: string }>}
 */
export function parseMedicamentosList(text) {
  const t = String(text || '').trim();
  if (!t || isNegatedDriveText(t)) return [];
  return t
    .split(/\s*,\s*(?=[A-ZÁÉÍÓÚÑ0-9])/)
    .map(function (chunk) {
      return chunk.trim();
    })
    .filter(Boolean)
    .map(function (med, idx) {
      return {
        id: 'drv_med_' + idx,
        medication: med,
        route: '',
        dosage: '',
        frequency: '',
      };
    });
}

/**
 * @param {string} text
 * @returns {Array<{ id: string, label: string }>}
 */
export function matchToxicomaniasSubstances(text) {
  const hay = String(text || '');
  if (!hay.trim() || isNegatedDriveText(hay)) return [];
  /** @type {Array<{ id: string, label: string }>} */
  const hits = [];
  Object.keys(toxicomaniasSubstances).forEach(function (id) {
    const label = toxicomaniasSubstances[id];
    const tokens = String(label)
      .split(/\s*[/(]/)
      .map(function (part) {
        return part.trim();
      })
      .filter(function (part) {
        return part.length >= 4;
      });
    const matched = tokens.some(function (token) {
      return new RegExp('\\b' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(hay);
    });
    if (matched) hits.push({ id, label });
  });
  return hits;
}

/** @type {Record<string, string>} */
export const AHF_RELATIVE_LABEL_MAP = Object.fromEntries(
  AHF_RELATIVES.map(function (rel) {
    return [rel.label.toUpperCase(), rel.id];
  }).concat([
    ['ABUELA', 'abuela_materna'],
    ['ABUELO', 'abuelo_materno'],
  ])
);

/**
 * @param {string} text
 * @returns {Array<{ id: string, conditionId: string, relativeId: string, diagnosis: string, treatment: string, vitalStatus: string }>}
 */
export function parseAhfRelativeLines(text) {
  /** @type {Array<{ id: string, conditionId: string, relativeId: string, diagnosis: string, treatment: string, vitalStatus: string }>} */
  const entries = [];
  String(text || '')
    .split('\n')
    .forEach(function (raw, lineIdx) {
      const line = raw.trim();
      const m = /^([A-ZÁÉÍÓÚÑ\s]+)\s*[:;]\s*(.+)$/i.exec(line);
      if (!m) return;
      const label = m[1].trim().toUpperCase();
      const value = m[2].trim();
      const relativeId = AHF_RELATIVE_LABEL_MAP[label];
      if (!relativeId || !value || isNegatedDriveText(value)) return;

      const vitalStatus = /FINAD|FALLECID|FALLEC/i.test(value)
        ? 'fallecido'
        : /\bVIV[OA]\b|\bSANO\b/i.test(value)
          ? 'vivo'
          : 'desconocido';

      const conditions = matchCatalogConditions(value, ahfConditions);
      if (conditions.length) {
        conditions.forEach(function (cond) {
          entries.push({
            id: 'drv_ahf_' + lineIdx + '_' + relativeId + '_' + cond.id,
            conditionId: cond.id,
            relativeId: relativeId,
            diagnosis: value,
            treatment: '',
            vitalStatus: vitalStatus,
          });
        });
        return;
      }

      entries.push({
        id: 'drv_ahf_' + lineIdx + '_' + relativeId + '_otro',
        conditionId: 'otro',
        relativeId: relativeId,
        diagnosis: value,
        treatment: '',
        vitalStatus: vitalStatus,
      });
    });
  return entries;
}

function isNegatedSubsectionBody(body) {
  const t = String(body || '').trim();
  if (!t) return true;
  if (isNegatedDriveText(t)) return true;
  const inline = /^[^:]+:\s*(.+)$/i.exec(t);
  if (inline) return isNegatedDriveText(inline[1].trim());
  return false;
}

/**
 * @param {string} key
 * @param {string} body
 * @param {HcStructuredSuggestion[]} suggestions
 * @returns {boolean}
 */
export function appSubsectionShouldStrip(key, body, suggestions) {
  if (!body || !String(body).trim()) return false;
  if (isNegatedSubsectionBody(body)) return true;

  const accepted = (suggestions || []).filter(function (s) {
    return s.include !== false;
  });

  if (key === 'medicamentos') {
    return accepted.some(function (s) {
      return s.target === 'app.medicamentosActuales';
    });
  }
  if (key === 'alergias') {
    return accepted.some(function (s) {
      return s.target === 'app.alergiasNegado' || s.target === 'app.alergiaMedicamentos';
    });
  }
  if (key === 'inmunizaciones') {
    return accepted.some(function (s) {
      return s.target === 'app.inmunizaciones';
    });
  }
  if (key === 'transfusiones') {
    return accepted.some(function (s) {
      return s.target === 'app.transfusionesEntries';
    });
  }
  if (key === 'hospitalizaciones') {
    return accepted.some(function (s) {
      return s.target === 'app.hospitalizaciones';
    });
  }
  if (key === 'cirugias') {
    return accepted.some(function (s) {
      return s.target === 'app.cirugias';
    });
  }
  if (key === 'traumaticos') {
    return accepted.some(function (s) {
      return s.target === 'app.traumaticosEntries';
    });
  }
  if (key === 'ecd' || key === 'enfermedades') {
    return accepted.some(function (s) {
      return s.target === 'app.conditions';
    });
  }
  return false;
}

/**
 * @param {string} text
 * @param {HcStructuredSuggestion[]} suggestions
 * @returns {string}
 */
