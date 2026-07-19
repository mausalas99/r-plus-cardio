import { extraerConRango, extraerConRangoSuero } from './labs-extract.mjs';
import {
  extractAllTroponinaFromText_,
  TROPONINA_HS_NORMAL_MAX_NG_L,
} from './labs-troponin.mjs';
import { extraerProcalcitonina_ } from './labs-chemistry.mjs';
import { bloqueCitoquimicoLiquidosFull } from './labs-fluidos.mjs';

/** Meses abreviados (reportes en inglés o español) → número 01–12 */
var LAB_FECHA_MESES_ABBREV = { ene:'01', feb:'02', mar:'03', abr:'04', may:'05', jun:'06', jul:'07', ago:'08', sep:'09', oct:'10', nov:'11', dic:'12', jan:'01', apr:'04', aug:'08', dec:'12' };

function padFechaDMY(d, m, yStr) {
  var y = String(yStr);
  if (y.length === 2) y = '20' + y;
  return String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
}

/**
 * Fecha del estudio en dd/mm/aaaa desde el texto crudo del laboratorio.
 * Evita usar la fecha de hoy cuando el reporte trae Fecha registro / resultado / muestra en otro formato.
 */
export function extractLabReportFechaDMY(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return '';
  var t = textoBruto;
  var m = t.match(/Fecha\s+Registro\s*:?\s*\r?\n?\s*([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (m) {
    var mon = LAB_FECHA_MESES_ABBREV[m[1].toLowerCase().slice(0, 3)];
    if (mon) return padFechaDMY(m[2], mon, m[3]);
  }
  var patronesNum = [
    /Fecha\s+(?:de\s+)?(?:Registro|resultado|Resultado|muestra|Muestra|emisi[oó]n|ingreso|extracci[oó]n)\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
    /(?:Fecha|FECHA)\s+DEL\s+ESTUDIO\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
    /Recepci[oó]n\s*(?:de\s*)?(?:muestra)?\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i,
    /(?:Captura|Validaci[oó]n|Reporte)\s*:?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/i
  ];
  for (var i = 0; i < patronesNum.length; i++) {
    m = t.match(patronesNum[i]);
    if (m) return padFechaDMY(m[1], m[2], m[3]);
  }
  var head = t.slice(0, 3200);
  m = head.match(/\bFecha\s*:\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/i);
  if (m) return padFechaDMY(m[1], m[2], m[3]);
  return '';
}

/** Encabezado típico de reporte SOME (copiar desde «Expediente:»). */
export function looksLikeSomeLabReport(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return false;
  var t = textoBruto;
  if (!/Expediente\s*:/i.test(t)) return false;
  if (!/Nombre\s*:/i.test(t)) return false;
  return /Fecha\s+Registro/i.test(t) || /HEMATOLOG[IÍ]A|QU[IÍ]MICA|BIOMETR[IÍ]A|GASOMETR[IÍ]A|BANCO\s+DE\s+SANGRE|TROPONINA/i.test(t);
}

function applyMeridiemHour(hh, meridiemRaw) {
  if (!meridiemRaw) return hh;
  var t = String(meridiemRaw).toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  var isPm = t === 'pm' || t === 'p' || t.indexOf('pm') !== -1;
  var isAm = t === 'am' || t === 'a' || t.indexOf('am') !== -1;
  if (isPm && !isAm) {
    if (hh < 12) return hh + 12;
    return hh;
  }
  if (isAm && !isPm) {
    if (hh === 12) return 0;
    return hh;
  }
  return hh;
}

function horaFromFechaRegistroMatch(m) {
  if (!m) return '';
  var hh = parseInt(m[1], 10);
  var mm = parseInt(m[2], 10);
  if (!isFinite(hh) || !isFinite(mm)) return '';
  hh = applyMeridiemHour(hh, m[4]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/**
 * Hora de toma/registro (HH:MM, 24 h) desde Fecha Registro del reporte SOME.
 */
export function extractLabReportHora(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return '';
  var head = textoBruto.slice(0, 4000);
  var m = head.match(
    /Fecha\s+Registro\s*:?[\s\t]*[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i
  );
  if (m) return horaFromFechaRegistroMatch(m);
  m = head.match(
    /Fecha\s+Registro\s*:?[\s\t]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*((?:a|p)\.?\s*m\.?|AM|PM)?/i
  );
  if (m) return horaFromFechaRegistroMatch(m);
  return '';
}

function putTrendRef_(refs, sectionKey, fieldKey, data) {
  if (!data || data.min == null || data.max == null) return;
  var min = Number(data.min);
  var max = Number(data.max);
  if (!isFinite(min) || !isFinite(max) || max <= min) return;
  if (!refs[sectionKey]) refs[sectionKey] = {};
  refs[sectionKey][fieldKey] = [min, max];
}

/** Bloques de texto alineados con procesarLabs (SOME / hospital). */
function someReportBlocks_(textoBruto) {
  var tNorm = textoBruto.replace(/\s+/g, ' ');
  var mGaso = tNorm.match(
    /GASOMETRIA.*?(?=BIOMETRIA|CITOLOGIA|QUIMICA|ELECTROLITOS|PFH|COAGULACION|CITOQUIMICO|$)/i
  );
  var bloqueGaso = mGaso ? mGaso[0] : '';
  var mLCR =
    textoBruto.match(/CITOQUIMICO\s+DE\s+LCR.*?(?=BACTERIOLOGIA|CUADERNILLO|$)/i) ||
    textoBruto.match(/CITOQUIMICO\s+LIQ\.?\s+LCR.*?(?=BACTERIOLOGIA|CUADERNILLO|$)/i) ||
    textoBruto.match(/CITOQUIMICO\s+LCR.*?(?=BACTERIOLOGIA|CUADERNILLO|$)/i);
  var bloqueLCR = mLCR ? mLCR[0] : '';
  var bloqueCitoLC = bloqueCitoquimicoLiquidosFull(textoBruto);
  var mEGO = tNorm.match(
    /(?:URIANALISIS|EXAMEN GENERAL DE ORINA|ANALISIS DE ORINA).*?(?=BACTERIOLOGIA|CULTIVO|COMENTARIO DE MUESTRA|$)/i
  );
  var bloqueEGO = mEGO ? mEGO[0] : '';
  var tSinLiqCorp = tNorm;
  if (bloqueCitoLC) {
    tSinLiqCorp = tNorm.replace(bloqueCitoLC.replace(/\r/g, '').replace(/\s+/g, ' '), ' ');
  }
  var textoQS = tSinLiqCorp
    .replace(bloqueGaso, ' ')
    .replace(bloqueEGO, ' ')
    .replace(bloqueLCR ? bloqueLCR.replace(/\s+/g, ' ') : '', ' ');
  var esSoloGaso =
    /GASOMETRIA/i.test(tNorm) &&
    !/BIOMETRIA|QUIMICA|ELECTROLITOS|PFH|COAGULACION|CULTIVO/i.test(tNorm);
  return { tNorm: tNorm, tSinLiqCorp: tSinLiqCorp, textoQS: textoQS, bloqueGaso: bloqueGaso, esSoloGaso: esSoloGaso };
}

/**
 * Rangos min/max del reporte (columna Valor de Referencia) por sección y analito R+.
 * Usado en tendencias; misma extracción que parseBH_/QS_/ESC_/PFH_/gasometría.
 */
export function buildRefsBySectionFromReport(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return {};
  var blocks = someReportBlocks_(textoBruto);
  var tNorm = blocks.tSinLiqCorp;
  var textoQS = blocks.textoQS;
  var bloqueGaso = blocks.bloqueGaso;
  var refs = {};

  if (!blocks.esSoloGaso) {
    putTrendRef_(refs, 'BH', 'Hb', extraerConRango(['HGB', 'HEMOGLOBINA TOTAL', 'HEMOGLOBINA'], tNorm));
    putTrendRef_(refs, 'BH', 'Hto', extraerConRango(['HCT ', 'HEMATOCRITO'], tNorm));
    putTrendRef_(refs, 'BH', 'VCM', extraerConRango(['MCV ', 'VCM '], tNorm));
    putTrendRef_(refs, 'BH', 'HCM', extraerConRango(['MCH ', 'HCM '], tNorm));
    putTrendRef_(refs, 'BH', 'CHCM', extraerConRango(['MCHC', 'CHCM'], tNorm));
    putTrendRef_(refs, 'BH', 'RDW', extraerConRango(['RDW '], tNorm));
    putTrendRef_(refs, 'BH', 'Leu', extraerConRango(['WBC '], tNorm));
    putTrendRef_(refs, 'BH', 'Neu', extraerConRango(['NEU '], tNorm));
    putTrendRef_(refs, 'BH', 'Eos', extraerConRango(['EOS '], tNorm));
    putTrendRef_(refs, 'BH', 'Lin', extraerConRango(['LYM ', 'LINFOCITOS'], tNorm));
    putTrendRef_(refs, 'BH', 'Mono', extraerConRango(['MONO '], tNorm));
    putTrendRef_(refs, 'BH', 'Baso', extraerConRango(['BASO '], tNorm));
    putTrendRef_(refs, 'BH', 'Plt', extraerConRango(['PLT '], tNorm));
    putTrendRef_(refs, 'BH', 'MPV', extraerConRango(['MPV ', 'VPM '], tNorm));
    putTrendRef_(refs, 'BH', 'RBC', extraerConRango(['RBC ', 'ERITROCITOS', 'HEMATIES'], tNorm));
    putTrendRef_(refs, 'BH', 'Ret', extraerConRango(['RETICULOCITOS'], tNorm));
    putTrendRef_(refs, 'BH', 'TP', extraerConRango(['TIEMPO DE PROTROMBINA'], tNorm));
    putTrendRef_(refs, 'BH', 'TTP', extraerConRango(['TIEMPO DE TROMBOPLASTINA'], tNorm));
    putTrendRef_(refs, 'BH', 'INR', extraerConRango(['INR ', 'INR'], tNorm));

    putTrendRef_(refs, 'QS', 'Glu', extraerConRangoSuero(['GLUCOSA EN SANGRE', 'GLUCOSA EN', 'GLUCOSA'], textoQS));
    putTrendRef_(refs, 'QS', 'Cr', extraerConRangoSuero(['CREATININA EN SANGRE', 'CREATININA'], textoQS));
    putTrendRef_(refs, 'QS', 'BUN', extraerConRangoSuero(['NITROGENO DE LA UREA EN SANGRE', 'NITROGENO DE LA UREA', 'UREA'], textoQS));
    putTrendRef_(refs, 'QS', 'PCR', extraerConRangoSuero(['PROTEINA C REACTIVA', 'PROTEÍNA C REACTIVA'], textoQS));
    putTrendRef_(refs, 'QS', 'PCT', extraerProcalcitonina_(textoQS));
    putTrendRef_(refs, 'QS', 'AU', extraerConRangoSuero(['ACIDO URICO EN SANGRE', 'ACIDO URICO', 'ÁCIDO ÚRICO'], textoQS));
    putTrendRef_(refs, 'QS', 'TGL', extraerConRangoSuero(['TRIGLICERIDOS', 'TRIGLICÉRIDOS'], textoQS));
    putTrendRef_(refs, 'QS', 'COL', extraerConRangoSuero(['COLESTEROL'], textoQS));
    putTrendRef_(refs, 'QS', 'VSG', extraerConRangoSuero(['VSG ', 'VELOCIDAD DE SEDIMENTACION'], textoQS));
    putTrendRef_(refs, 'QS', 'CPK', extraerConRangoSuero(['CPK CREATIN FOSFO QUINASA', 'CPK '], textoQS));

    putTrendRef_(refs, 'ESC', 'Na', extraerConRangoSuero(['SODIO'], textoQS));
    putTrendRef_(refs, 'ESC', 'Cl', extraerConRangoSuero(['CLORO'], textoQS));
    putTrendRef_(refs, 'ESC', 'K', extraerConRangoSuero(['POTASIO'], textoQS));
    putTrendRef_(refs, 'ESC', 'Ca', extraerConRangoSuero(['CALCIO EN SUERO', 'CALCIO'], textoQS));
    putTrendRef_(refs, 'ESC', 'F', extraerConRangoSuero(['FOSFORO EN SANGRE', 'FOSFORO', 'FÓSFORO'], textoQS));
    putTrendRef_(refs, 'ESC', 'Mg', extraerConRangoSuero(['MAGNESIO'], textoQS));

    putTrendRef_(refs, 'PFHs', 'Alb', extraerConRangoSuero(['ALBUMINA'], tNorm));
    putTrendRef_(refs, 'PFHs', 'AST', extraerConRango(['AST(ASPARTATO AMINOTRANSFERASA)', 'AST '], tNorm));
    putTrendRef_(refs, 'PFHs', 'ALT', extraerConRango(['ALT ALANIN AMINO TRANSFERASA', 'ALT '], tNorm));
    putTrendRef_(refs, 'PFHs', 'FA', extraerConRango(['ALP FOSFATASA ALCALINA', 'FOSFATASA ALCALINA'], tNorm));
    putTrendRef_(refs, 'PFHs', 'BT', extraerConRango(['BILIRRUBINA TOTAL'], tNorm));
    putTrendRef_(refs, 'PFHs', 'BD', extraerConRango(['BILIRRUBINA DIRECTA'], tNorm));
    putTrendRef_(refs, 'PFHs', 'BI', extraerConRango(['BILIRRUBINA INDIRECTA'], tNorm));
    putTrendRef_(refs, 'PFHs', 'LDH', extraerConRango(['LDH DESHIDROGENASA LACTICA', 'LDH '], tNorm));
    putTrendRef_(refs, 'PFHs', 'Amil', extraerConRango(['AMILASA SERICA', 'AMILASA'], tNorm));
    putTrendRef_(refs, 'LIPASA', 'Lip', extraerConRango(['LIPASA SERICA', 'LIPASA '], textoQS));
  }

  var tropHits = extractAllTroponinaFromText_(textoBruto);
  if (tropHits.length) {
    var tropMax = TROPONINA_HS_NORMAL_MAX_NG_L;
    var tropMin = 0;
    var first = tropHits[0];
    if (first.max != null && first.min != null && first.max > first.min) {
      tropMin = first.min;
      tropMax = first.max;
    }
    putTrendRef_(refs, 'TROP', 'TnI1', {
      valor: first.valor,
      min: tropMin,
      max: tropMax,
    });
    if (tropHits.length > 1) {
      var last = tropHits[tropHits.length - 1];
      putTrendRef_(refs, 'TROP', 'TnI2', {
        valor: last.valor,
        min: tropMin,
        max: tropMax,
      });
    }
  }

  if (bloqueGaso) {
    putTrendRef_(refs, 'GASES', 'pH', extraerConRango(['PH '], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'pCO2', extraerConRango(['PCO2'], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'pO2', extraerConRango(['PO2 '], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'Na', extraerConRango(['SODIO'], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'K', extraerConRango(['POTASIO'], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'GLU', extraerConRango(['GLUCOSA'], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'Lactato', extraerConRango(['LACTATO'], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'Bica', extraerConRango(['HCO3'], bloqueGaso));
    putTrendRef_(refs, 'GASES', 'Hto', extraerConRango(['HCT ', 'HEMATOCRITO'], bloqueGaso));
    var iCaData = extraerConRango(['CA++ IONIZADO', 'CALCIO IONIZADO', 'CA IONIZADO'], bloqueGaso);
    putTrendRef_(refs, 'GASES', 'iCa', {
      valor: iCaData.valor,
      min: iCaData.min != null ? iCaData.min : 1.12,
      max: iCaData.max != null ? iCaData.max : 1.32,
    });
  }

  return refs;
}
