import { toNum_ } from './labs-extract.mjs';

/** @param {string} raw */
export function parseFluidLeu_(raw) {
  var c = String(raw || '').replace(/\*/g, '').trim();
  if (!c) return null;
  if (/^\d{1,3},\d{3}$/.test(c)) c = c.replace(',', '');
  else c = c.replace(',', '.');
  return toNum_(c);
}

/**
 * PMN absoluto o %; infiere conteo con leu total cuando aplica.
 * @param {string} raw
 * @param {number|null} leuNum
 */
export function parsePmnField_(raw, leuNum) {
  var empty = { pmnNum: null, pmnPct: null, predominant: false };
  if (!raw) return empty;
  var s = String(raw).replace(/\*/g, '').trim().toUpperCase();
  if (/PREDOMIN/i.test(s)) return { pmnNum: null, pmnPct: null, predominant: true };
  var pctMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
  if (!pctMatch) return empty;
  var n = toNum_(pctMatch[1]);
  if (n == null) return empty;
  if (/%/.test(s) || (n <= 100 && leuNum != null)) {
    return {
      pmnNum: leuNum != null ? Math.round((leuNum * n) / 100) : null,
      pmnPct: n,
      predominant: n >= 50,
    };
  }
  return { pmnNum: n, pmnPct: null, predominant: true };
}

/** @param {string} raw */
export function isGramNegative_(raw) {
  return /\bNEGAT/i.test(String(raw || ''));
}

/** @param {string} raw */
export function gramIsPositive_(raw) {
  var s = String(raw || '').trim();
  if (!s || isGramNegative_(s)) return false;
  return /\b(POSITIV|COCC|BACIL|POLIMORFONUCLE|ABUNDANT)/i.test(s);
}

/** Proteína LCR con posible sufijo de bandera (p. ej. 120B). */
export function parseLcrProteinMgdl_(raw) {
  var s = String(raw || '').replace(/\*/g, '').trim();
  if (!s) return null;
  var m = s.match(/^(\d+(?:[.,]\d+)?)/);
  return m ? toNum_(m[1]) : null;
}
