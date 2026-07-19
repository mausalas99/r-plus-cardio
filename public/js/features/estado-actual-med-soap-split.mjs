/**
 * Partición de campos de medicamentos para plantilla SOAP de Estado Actual.
 */

/**
 * @param {unknown} fieldVal
 * @returns {string[]}
 */
function parseMedPipeItems(fieldVal) {
  if (fieldVal == null || !String(fieldVal).trim()) return [];
  return String(fieldVal)
    .split(' | ')
    .map(function (s) {
      return String(s).trim();
    })
    .filter(Boolean);
}

/**
 * @param {string[]} items
 * @returns {string}
 */
function joinMedPipeItems(items) {
  return (items || [])
    .map(function (s) {
      return String(s).trim();
    })
    .filter(Boolean)
    .join(' | ');
}

var ANTIEMETIC_LINE_RE =
  /\b(ONDANSETRON|GRANISETRON|PALONOSETRON|METOCLOPRAMIDA|DROPERIDOL|DIMENHIDRINATO|BUTILHIOSCINA|BROMURO\s+DE\s+BUTILHIOSCINA|BUSCAPINA)\b/i;

var INSULIN_NM_LINE_RE =
  /\b(INSULINA|GLARGINA|DEGLUDEC|DETEMIR|NPH|ASPARTA|LISPRO|GLULISINA|HUMANA\s+RAPIDA)\b/i;

var RESCATE_NM_LINE_RE = /\bRESCATES\s+DE\s+INSULINA\b/i;

/**
 * @param {unknown} fieldVal
 * @returns {{ analgesia: string, antiemeticos: string }}
 */
export function partitionAnalgesiaForSoap(fieldVal) {
  /** @type {string[]} */
  var analgesia = [];
  /** @type {string[]} */
  var antiemeticos = [];
  parseMedPipeItems(fieldVal).forEach(function (line) {
    if (ANTIEMETIC_LINE_RE.test(line)) antiemeticos.push(line);
    else analgesia.push(line);
  });
  return { analgesia: joinMedPipeItems(analgesia), antiemeticos: joinMedPipeItems(antiemeticos) };
}

/**
 * @param {unknown} fieldVal
 * @returns {{ other: string, insulin: string, rescatesDisponibles: boolean }}
 */
export function partitionNmMedsForSoap(fieldVal) {
  /** @type {string[]} */
  var other = [];
  /** @type {string[]} */
  var insulin = [];
  var rescatesDisponibles = false;
  parseMedPipeItems(fieldVal).forEach(function (line) {
    if (RESCATE_NM_LINE_RE.test(line)) {
      rescatesDisponibles = true;
      return;
    }
    if (INSULIN_NM_LINE_RE.test(line)) insulin.push(line);
    else other.push(line);
  });
  return {
    other: joinMedPipeItems(other),
    insulin: joinMedPipeItems(insulin),
    rescatesDisponibles: rescatesDisponibles,
  };
}
