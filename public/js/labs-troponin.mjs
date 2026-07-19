import { marcarSegunRango, fmt } from './labs-extract.mjs';

/** Umbral URL hs-cTnI (ng/L) cuando el reporte no trae rango numérico útil. */
export const TROPONINA_HS_NORMAL_MAX_NG_L = 34;

export const TROPONINA_TEST_NAMES = [
  'TROPONINA I (ALTA SENSIBILIDAD)',
  'HS TNL O TROPONINA I',
  'HSTNL O TROPONINA I',
  'HSTNL O TROPONINA',
  'TROPONINA I',
  'TROPONINA',
];

function troponinaQualFromSub_(sub) {
  if (/INDETERMINADO/i.test(sub)) return 'indet';
  if (/POSITIVO/i.test(sub)) return 'pos';
  if (/NEGATIVO/i.test(sub)) return 'neg';
  return '';
}

function troponinaRefsFromHit_(hit) {
  if (hit.max != null && hit.min != null && hit.max > hit.min) {
    return { min: hit.min, max: hit.max };
  }
  return { min: 0, max: TROPONINA_HS_NORMAL_MAX_NG_L };
}

function formatTnIDisplay_(valorStr, qual, minRef, maxRef) {
  var out = fmt(marcarSegunRango(valorStr, minRef, maxRef));
  var v = parseFloat(String(valorStr).replace(',', '.'));
  var flagged =
    qual === 'indet' ||
    qual === 'pos' ||
    (isFinite(v) && (v > maxRef || v < minRef));
  if (flagged && out !== '---' && !String(out).endsWith('*')) out += '*';
  return out;
}

function parseTnINum_(token) {
  var m = String(token || '').match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Δ% serial hs-cTnI: (TnI₂ − TnI₁) / TnI₁ × 100.
 * @param {number} v1
 * @param {number} v2
 */
export function troponinaDeltaPct_(v1, v2) {
  if (!isFinite(v1) || !isFinite(v2) || v1 === 0) return null;
  return ((v2 - v1) / v1) * 100;
}

export function formatTroponinaDeltaPct_(pct) {
  if (pct == null || !isFinite(pct)) return '';
  var rounded = Math.round(pct * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + '%';
}

/**
 * @param {string} textoBruto
 * @returns {Array<{ valor: string, min: number|null, max: number|null, qual: string, index: number }>}
 */
export function extractAllTroponinaFromText_(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return [];
  var texto = textoBruto.replace(/\r/g, '');
  var tUp = texto.toUpperCase();
  var hits = [];
  TROPONINA_TEST_NAMES.forEach(function (nombre) {
    var nameUp = nombre.toUpperCase();
    var start = 0;
    while (true) {
      var idx = tUp.indexOf(nameUp, start);
      if (idx === -1) break;
      var sub = texto.substring(idx, idx + 320);
      var subText = texto.substring(idx + nameUp.length, idx + nameUp.length + 220);
      var mValor = subText.match(/(-?\d+[.,]?\d*)/);
      if (mValor) {
        var mRango = subText.match(/(\d+[.,]?\d*)\s*-\s*(\d+[.,]?\d*)/);
        hits.push({
          valor: mValor[1],
          min: mRango ? parseFloat(mRango[1].replace(',', '.')) : null,
          max: mRango ? parseFloat(mRango[2].replace(',', '.')) : null,
          qual: troponinaQualFromSub_(sub),
          index: idx,
        });
      }
      start = idx + nameUp.length;
    }
  });
  hits.sort(function (a, b) {
    return a.index - b.index;
  });
  var deduped = [];
  hits.forEach(function (h) {
    var overlap = deduped.find(function (prev) {
      return Math.abs(prev.index - h.index) < 100 && prev.valor === h.valor;
    });
    if (!overlap) deduped.push(h);
  });
  return deduped;
}

/**
 * @param {Array<{ display: string, raw: number|null }>} values
 */
export function buildTroponinaResLabLine_(values) {
  var list = (values || []).filter(function (v) {
    return v && v.display && v.display !== '---';
  });
  if (!list.length) return '';
  if (list.length === 1) {
    return 'TROP\tTnI ' + list[0].display;
  }
  var v1 = list[0];
  var v2 = list[list.length - 1];
  var pct = troponinaDeltaPct_(v1.raw, v2.raw);
  var delta = formatTroponinaDeltaPct_(pct);
  var body = 'TnI1 ' + v1.display + ' TnI2 ' + v2.display;
  if (delta) body += ' Δ% ' + delta;
  return 'TROP\t' + body;
}

/** @param {string} row */
export function parseTnIDisplayTokensFromResLabRow_(row) {
  var s = String(row || '');
  if (!/^TROP\b/i.test(s.trim())) return [];
  var out = [];
  var re = /\bTnI(\d?)\s+([\d.]+\*?)/gi;
  var m;
  while ((m = re.exec(s))) {
    out.push({ display: m[2], raw: parseTnINum_(m[2]) });
  }
  return out;
}

/**
 * Fusiona varias filas TROP (p. ej. dos reportes SOME) en par + Δ%.
 * @param {string[]} rows
 */
export function mergeTroponinaResLabRows_(rows) {
  var tokens = [];
  (rows || []).forEach(function (row) {
    parseTnIDisplayTokensFromResLabRow_(row).forEach(function (tok) {
      tokens.push(tok);
    });
  });
  if (!tokens.length) return '';
  if (tokens.length === 1) return 'TROP\tTnI ' + tokens[0].display;
  return buildTroponinaResLabLine_([tokens[0], tokens[tokens.length - 1]]);
}

/**
 * Tendencias: TnI suelta → TnI1; excluir Δ% del panel.
 * @param {Record<string, number>} row
 */
export function normalizeTropTrendFields_(row) {
  if (!row || typeof row !== 'object') return row;
  if (row.TnI != null && row.TnI1 == null) row.TnI1 = row.TnI;
  delete row.TnI;
  delete row['Δ%'];
  delete row.dTnI;
  return row;
}

/**
 * Troponina I alta sensibilidad (BANCO DE SANGRE / SOME).
 * @param {string} textoBruto
 */
export function parseTroponina_(textoBruto) {
  if (!textoBruto || typeof textoBruto !== 'string') return '';
  var tUp = textoBruto.toUpperCase();
  if (
    tUp.indexOf('TROPONINA') === -1 &&
    tUp.indexOf('HSTNL') === -1 &&
    tUp.indexOf('HS TNL') === -1
  ) {
    return '';
  }
  var hits = extractAllTroponinaFromText_(textoBruto);
  if (!hits.length) return '';
  var values = hits.map(function (hit) {
    var refs = troponinaRefsFromHit_(hit);
    return {
      display: formatTnIDisplay_(hit.valor, hit.qual, refs.min, refs.max),
      raw: parseFloat(String(hit.valor).replace(',', '.')),
    };
  });
  if (values.length === 1) {
    return buildTroponinaResLabLine_(values);
  }
  return buildTroponinaResLabLine_([values[0], values[values.length - 1]]);
}
