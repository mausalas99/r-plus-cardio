import { trimStr } from './med-receta-util.mjs';
import { getMedCatalogSoapTokens } from './med-receta-catalog.mjs';
import { normalizeNombreForSoapClassify } from './med-receta-nombre.mjs';
import { isPrnMedicationItem } from './med-receta-format.mjs';
import { isInsulinRescateMedicationItem } from './insulin-rescate-detect.mjs';
import {
  classifyVasopressors_,
  classifyAbx_,
  classifyAnalgesia_,
  classifyAntiemeticos_,
  classifyDiureticos_,
  classifyAntitromboticos_,
  classifyAnticoagulacion_,
  classifyEstatinas_,
  classifyViaAerea_,
  classifySedacion_,
  classifyAntiepilepticos_,
  classifyAntiparkinsonianos_,
  classifyAntidotos_,
  classifyAntiarritmicos_,
  classifyTransfusiones_,
  classifyNmDiabetesThyroidPpi_,
  classifyNmSupport_,
  classifyAntihta_,
} from './med-receta-soap-families.mjs';

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function overlayTokensMatch(nNorm, tokens) {
  if (!tokens || !tokens.length) return false;
  var parts = [];
  for (var i = 0; i < tokens.length; i += 1) {
    var x = normalizeNombreForSoapClassify(tokens[i]);
    if (x) parts.push(escapeRegExp(x));
  }
  if (!parts.length) return false;
  return new RegExp('\\b(' + parts.join('|') + ')\\b').test(nNorm);
}

function extractMgDoseFromMedBlob(blob) {
  var m = String(blob || '').match(/\b(\d+(?:[.,]\d+)?)\s*MG\b/);
  if (!m) return null;
  var v = parseFloat(String(m[1]).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function isAspirinNombre(n) {
  return /\b(ACETILSALICILICO|ACIDO\s+ACETILSALICILICO|ACIDO\s+ACETIL\s+SALICILICO|ASPIRINA)\b/.test(
    n
  );
}

/** Destinos SOAP asignables manualmente cuando la clasificación automática es «otros». */
export const SOAP_DESTINATION_KEYS = [
  'analgesia',
  'antiemeticos',
  'sedacion',
  'antiepilepticos',
  'antiparkinsonianos',
  'antidotos',
  'viaAerea',
  'abx',
  'transfusiones',
  'antihta',
  'diuretico',
  'antitromboticos',
  'anticoagulacion',
  'antiarritmicos',
  'estatinas',
  'vasop',
  'nm',
];

export const SOAP_DESTINATION_LABELS = {
  analgesia: 'Analgésicos',
  antiemeticos: 'Antieméticos',
  sedacion: 'Sedación / delirium',
  antiepilepticos: 'Antiepilépticos',
  antiparkinsonianos: 'Antiparkinsonianos',
  antidotos: 'Antídotos',
  viaAerea: 'Vía aérea (broncodilatadores / mucolíticos)',
  antihta: 'Antihipertensivos',
  diuretico: 'Diuréticos',
  antitromboticos: 'Tromboprofilaxis / antiagregación',
  anticoagulacion: 'Anticoagulación terapéutica',
  antiarritmicos: 'Antiarrítmicos',
  estatinas: 'Estatinas',
  abx: 'Antibióticos / antifúngicos',
  transfusiones: 'Transfusiones / hemoderivados',
  vasop: 'Vasopresores / inotrópicos',
  nm: 'NM (soporte, crónicos, etc.)',
};

/**
 * Categoría efectiva para volcar a SOAP: auto-clasificación o override manual en «otros».
 * @param {{ nombreRaw?: string, soapCatOverride?: string }} item
 * @param {(nombreRaw: string) => string} classifyFn
 */
export function effectiveSoapCategory(item, classifyFn) {
  if (!item) return 'otros';
  var auto = classifyFn(item.nombreRaw, item.dosisRaw);
  if (auto !== 'otros') return auto;
  var ov = trimStr(item.soapCatOverride);
  if (ov && SOAP_DESTINATION_KEYS.indexOf(ov) >= 0) return ov;
  return 'otros';
}

/**
 * Medicamentos «otros» marcados SOAP sin destino asignado.
 * @param {unknown[]} items
 * @param {Record<string, boolean>} selMap
 * @param {(nombreRaw: string) => string} classifyFn
 */
export function unassignedOtrosSoapItems(items, selMap, classifyFn) {
  var out = [];
  var list = Array.isArray(items) ? items : [];
  list.forEach(function (it) {
    if (!it || !selMap[it.id] || it.suspendido) return;
    if (effectiveSoapCategory(it, classifyFn) === 'otros') out.push(it);
  });
  return out;
}

/**
 * Clasificación automática para campos SOAP / Estado Actual (sin override manual).
 * @param {string} [dosisRaw] — opcional; desambigua dosis (p. ej. AAS 100 mg antiplaquetario vs 500 mg analgésico).
 */
function classifyByCatalogTokens_(n, o) {
  if (overlayTokensMatch(n, o.vasop)) return 'vasop';
  if (overlayTokensMatch(n, o.abx)) return 'abx';
  if (overlayTokensMatch(n, o.analgesia)) return 'analgesia';
  if (overlayTokensMatch(n, o.antihta)) return 'antihta';
  return '';
}

function classifyByNameHeuristics_(n) {
  if (classifyVasopressors_(n)) return 'vasop';
  if (classifyAbx_(n)) return 'abx';
  if (classifyTransfusiones_(n)) return 'transfusiones';
  if (classifyAnalgesia_(n)) return 'analgesia';
  if (classifyAntiemeticos_(n)) return 'antiemeticos';
  if (classifyDiureticos_(n)) return 'diuretico';
  if (classifyAnticoagulacion_(n)) return 'anticoagulacion';
  if (classifyAntitromboticos_(n)) return 'antitromboticos';
  if (classifyEstatinas_(n)) return 'estatinas';
  if (classifyAntiarritmicos_(n)) return 'antiarritmicos';
  if (classifyViaAerea_(n)) return 'viaAerea';
  if (classifySedacion_(n)) return 'sedacion';
  if (classifyAntiepilepticos_(n)) return 'antiepilepticos';
  if (classifyAntiparkinsonianos_(n)) return 'antiparkinsonianos';
  if (classifyAntidotos_(n)) return 'antidotos';
  if (classifyNmSupport_(n)) return 'nm';
  if (classifyNmDiabetesThyroidPpi_(n)) return 'nm';
  if (classifyAntihta_(n)) return 'antihta';
  return '';
}

/**
 * D50 no va al SOAP. PRN solo en analgesia, salvo rescates de insulina por glucometría (SOME).
 */
export function shouldIncludeMedicationInSoap(item, classifyFn) {
  if (!item || item.suspendido) return false;
  var blob = normalizeNombreForSoapClassify(
    [item.nombreRaw, item.dosisRaw, item.frecuenciaRaw].filter(Boolean).join(' ')
  );
  if (/\bDEXTROSA\s*50\b/.test(blob)) return false;
  if (isInsulinRescateMedicationItem(item)) return true;
  if (isPrnMedicationItem(item)) {
    var classify = classifyFn || classifyMedicationSoapCategory;
    return classify(item.nombreRaw, item.dosisRaw) === 'analgesia';
  }
  return true;
}

export function classifyMedicationSoapCategory(nombreRaw, dosisRaw) {
  var n = normalizeNombreForSoapClassify(nombreRaw);
  var doseBlob = normalizeNombreForSoapClassify([nombreRaw, dosisRaw].filter(Boolean).join(' '));
  if (isAspirinNombre(n)) {
    var mg = extractMgDoseFromMedBlob(doseBlob);
    if (mg == null || mg <= 160) return 'antitromboticos';
    return 'analgesia';
  }
  var fromCatalog = classifyByCatalogTokens_(n, getMedCatalogSoapTokens());
  if (fromCatalog) return fromCatalog;
  var fromHeuristic = classifyByNameHeuristics_(n);
  if (fromHeuristic) return fromHeuristic;
  return 'otros';
}
