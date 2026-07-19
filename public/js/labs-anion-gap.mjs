// Anion gap helpers: serum AG, albumin-corrected AGc, urinary UAG.
import { extraerConRango, marcarSegunRango } from './labs-extract.mjs';

function parseLabNum_(str) {
  if (str === '---' || str == null || str === '') return null;
  var n = parseFloat(String(str).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function formatAgToken_(ag) {
  if (ag == null || !isFinite(ag)) return '---';
  var rounded = Math.round((ag + Number.EPSILON) * 10) / 10;
  var agStr = rounded === Math.trunc(rounded) ? String(rounded.toFixed(0)) : String(rounded);
  return marcarSegunRango(agStr, 8, 12);
}

function formatPlainToken_(n) {
  if (n == null || !isFinite(n)) return '---';
  var rounded = Math.round((n + Number.EPSILON) * 10) / 10;
  return rounded === Math.trunc(rounded) ? String(rounded.toFixed(0)) : String(rounded);
}

/**
 * Anión gap sérico clásico (sin K): AG = Na − (Cl + HCO₃⁻).
 * No aplica corrección por albúmina (usar computeAlbuminCorrectedAnionGapValue_).
 */
export function computeAnionGapValue_(naStr, clStr, hco3Str) {
  var na = parseLabNum_(naStr);
  var cl = parseLabNum_(clStr);
  var hco3 = parseLabNum_(hco3Str);
  if (na == null || cl == null || hco3 == null) return null;
  return na - (cl + hco3);
}

/**
 * AGcorr = AG + 2.5 × (4 − Alb[g/dL]). Requiere albúmina numérica.
 */
export function computeAlbuminCorrectedAnionGapValue_(naStr, clStr, hco3Str, albStr) {
  var ag = computeAnionGapValue_(naStr, clStr, hco3Str);
  if (ag == null) return null;
  var alb = parseLabNum_(albStr);
  if (alb == null) return null;
  return ag + 2.5 * (4 - alb);
}

/**
 * Brecha aniónica urinaria: UAG = Naᵤ + Kᵤ − Clᵤ (mEq/L).
 */
export function computeUrinaryAnionGapValue_(naUStr, kUStr, clUStr) {
  var na = parseLabNum_(naUStr);
  var k = parseLabNum_(kUStr);
  var cl = parseLabNum_(clUStr);
  if (na == null || k == null || cl == null) return null;
  return na + k - cl;
}

/** AG formateado con * si fuera de 8–12. */
export function computeAnionGap_(naStr, clStr, hco3Str) {
  return formatAgToken_(computeAnionGapValue_(naStr, clStr, hco3Str));
}

/** AGc formateado con * si fuera de 8–12; '---' sin albúmina. */
export function computeAlbuminCorrectedAnionGap_(naStr, clStr, hco3Str, albStr) {
  return formatAgToken_(computeAlbuminCorrectedAnionGapValue_(naStr, clStr, hco3Str, albStr));
}

/** UAG formateado (sin rango de referencia fijo). */
export function computeUrinaryAnionGap_(naUStr, kUStr, clUStr) {
  return formatPlainToken_(computeUrinaryAnionGapValue_(naUStr, kUStr, clUStr));
}

/**
 * Extrae Na/K/Cl urinarios de texto SOME (ignora séricos).
 * @returns {{ na: string, k: string, cl: string }}
 */
export function extractUrineElectrolytes_(texto) {
  if (!texto) return { na: '---', k: '---', cl: '---' };
  var na = extraerConRango(['SODIO EN ORINA', 'SODIO URINARIO'], texto);
  var k = extraerConRango(['POTASIO EN ORINA', 'POTASIO URINARIO'], texto);
  var cl = extraerConRango(['CLORO EN ORINA', 'CLORO URINARIO'], texto);
  return { na: na.valor, k: k.valor, cl: cl.valor };
}

/**
 * AG efectivo para delta-delta / interpretación: AGc si hay albúmina, si no AG crudo.
 */
export function resolveEffectiveAnionGapValue_(naStr, clStr, hco3Str, albStr) {
  var agc = computeAlbuminCorrectedAnionGapValue_(naStr, clStr, hco3Str, albStr);
  if (agc != null) return agc;
  return computeAnionGapValue_(naStr, clStr, hco3Str);
}
