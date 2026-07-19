/**
 * Variantes de texto clínico para pegado de monitoreo (soporte, sufijos, alias).
 */

/** @type {readonly [RegExp, string][]} */
const SOPORTE_FROM_TAIL = [
  [/VM\s+NO\s+INVASIVA|VMNI|VNI/i, 'VM no invasiva'],
  [/TRAQUEOSTOM[ÍI]A|\bTQT\b/i, 'Traqueostomía'],
  [/ALTO\s+FLUJO|OAF\b/i, 'Alto flujo'],
  [/PUNTILLAS?\s+NASALES?|C[Nn]?\s*AF/i, 'Puntillas nasales'],
  [/AIRE\s+AMBIENTE|\bAA\b/i, 'Aire ambiente'],
];

/**
 * @param {string} tail Texto después del valor de SatO2
 * @returns {string | null} Valor de select «Soporte respiratorio»
 */
export function soporteFromSatTail(tail) {
  var s = String(tail || '').trim();
  if (!s) return null;
  var u = s.toUpperCase();
  for (var i = 0; i < SOPORTE_FROM_TAIL.length; i++) {
    if (SOPORTE_FROM_TAIL[i][0].test(u)) return SOPORTE_FROM_TAIL[i][1];
  }
  return null;
}

/**
 * @param {string} line
 * @returns {{ value: number, soporteHint: string | null } | null}
 */
export function parseSatLineVariants(line) {
  var m = line.match(
    /^(?:SATURACI(?:O|Ó)N(?:\s+O2)?|SAT(?:O2)?|SPO2)\s*:?\s*([\d.,]+)\s*%?\s*(.*)$/i
  );
  if (!m) return null;
  var n = Number(String(m[1]).replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return { value: n, soporteHint: soporteFromSatTail(m[2]) };
}

/**
 * Quita sufijos habituales (LPM, MMHG, etc.) del valor capturado.
 * @param {string} raw
 * @returns {string}
 */
export function stripVitalUnitSuffix(raw) {
  return String(raw || '')
    .replace(/\s*(?:LPM|RPM|X\/MIN|\/MIN|MMHG|MM\s*HG|MG\/DL|CC|ML)\s*$/i, '')
    .trim();
}
