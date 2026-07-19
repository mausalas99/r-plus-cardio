/** Algoritmos de bomba de insulina — Hospital Universitario UANL (orientativo). */

export const INSULIN_PUMP_GLUCOSE_BANDS = [
  { label: '< 70', min: null, maxExclusive: 70, suspend: true },
  { label: '70 – 109', min: 70, maxExclusive: 110 },
  { label: '110 – 119', min: 110, maxExclusive: 120 },
  { label: '120 – 149', min: 120, maxExclusive: 150 },
  { label: '150 – 179', min: 150, maxExclusive: 180 },
  { label: '180 – 209', min: 180, maxExclusive: 210 },
  { label: '210 – 239', min: 210, maxExclusive: 240 },
  { label: '240 – 269', min: 240, maxExclusive: 270 },
  { label: '270 – 299', min: 270, maxExclusive: 300 },
  { label: '300 – 329', min: 300, maxExclusive: 330 },
  { label: '330 – 359', min: 330, maxExclusive: 360 },
  { label: '> 360', min: 360, maxExclusive: null },
];

export const INSULIN_PUMP_ALGORITHMS = [
  {
    id: 'insulin-pump-alg-1',
    label: 'Algoritmo 1',
    rates: [null, 0.2, 0.5, 1, 1.5, 2, 2, 3, 3, 4, 4, 6],
  },
  {
    id: 'insulin-pump-alg-2',
    label: 'Algoritmo 2',
    rates: [null, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 12],
  },
  {
    id: 'insulin-pump-alg-3',
    label: 'Algoritmo 3',
    rates: [null, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16],
  },
  {
    id: 'insulin-pump-alg-4',
    label: 'Algoritmo 4',
    rates: [null, 1.5, 3, 5, 7, 9, 12, 16, 20, 24, 28, 32],
  },
];

/**
 * @param {number} glucoseMgDl
 * @param {number} algorithmIndex 0–3
 */
export function insulinUnitsPerHourForGlucose(glucoseMgDl, algorithmIndex) {
  var glu = Number(glucoseMgDl);
  if (!Number.isFinite(glu)) return { unitsPerHour: null, band: null, suspend: false };
  var alg = INSULIN_PUMP_ALGORITHMS[algorithmIndex];
  if (!alg) return { unitsPerHour: null, band: null, suspend: false };
  for (var i = 0; i < INSULIN_PUMP_GLUCOSE_BANDS.length; i++) {
    var band = INSULIN_PUMP_GLUCOSE_BANDS[i];
    var okMin = band.min == null || glu >= band.min;
    var okMax = band.maxExclusive == null || glu < band.maxExclusive;
    if (!okMin || !okMax) continue;
    if (band.suspend) return { unitsPerHour: null, band: band.label, suspend: true };
    return { unitsPerHour: alg.rates[i], band: band.label, suspend: false };
  }
  return { unitsPerHour: null, band: null, suspend: false };
}

/**
 * @param {number | null | undefined} algorithmNumber 1–4
 * @returns {number | null} index 0–3
 */
export function insulinPumpAlgorithmIndex(algorithmNumber) {
  var n = Number(algorithmNumber);
  if (!Number.isFinite(n) || n < 1 || n > INSULIN_PUMP_ALGORITHMS.length) return null;
  return n - 1;
}

/**
 * Unidades/h según algoritmo SOME (1–4) y glucometría mg/dL.
 * @param {number | null | undefined} algorithmNumber
 * @param {number | null | undefined} glucoseMgDl
 */
export function insulinUnitsPerHourForAlgorithm(algorithmNumber, glucoseMgDl) {
  var idx = insulinPumpAlgorithmIndex(algorithmNumber);
  if (idx == null) return { unitsPerHour: null, band: null, suspend: false };
  return insulinUnitsPerHourForGlucose(glucoseMgDl, idx);
}
