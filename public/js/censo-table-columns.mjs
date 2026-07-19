/** Pesos de columnas del censo (PDF y vista previa deben coincidir). */
export const CENSO_COL_WEIGHTS = [
  { key: 'num', title: '#', weight: 20 },
  { key: 'cama', title: 'Cama', weight: 22 },
  { key: 'paciente', title: 'Paciente', weight: 70 },
  { key: 'dx', title: 'Dx', weight: 54 },
  { key: 'meds', title: 'ATB / Meds', weight: 64 },
  { key: 'labs', title: 'Labs', weight: 138 },
  { key: 'signos', title: 'Signos', weight: 88 },
  { key: 'io', title: 'I / E / B', weight: 72 },
  { key: 'accesos', title: 'Accesos', weight: 28 },
  { key: 'cultivos', title: 'Cultivos', weight: 58 },
  { key: 'pend', title: 'Pend.', weight: 78 },
];

/**
 * @returns {Array<{ key: string, title: string, pct: number }>}
 */
export function censoColumnPercents() {
  var sum = CENSO_COL_WEIGHTS.reduce(function (s, c) {
    return s + c.weight;
  }, 0);
  var cols = CENSO_COL_WEIGHTS.map(function (c) {
    return {
      key: c.key,
      title: c.title,
      pct: (c.weight / sum) * 100,
    };
  });
  var total = cols.reduce(function (s, c) {
    return s + c.pct;
  }, 0);
  var drift = 100 - total;
  if (drift !== 0) cols[cols.length - 1].pct += drift;
  return cols;
}

/**
 * @returns {string} reglas col.* para vista previa HTML
 */
export function censoColgroupCssRules() {
  return censoColumnPercents()
    .map(function (c) {
      var cls = c.key === 'paciente' ? 'pac' : c.key === 'meds' ? 'med' : c.key === 'labs' ? 'lab' : c.key;
      return 'col.' + cls + '{width:' + c.pct.toFixed(3) + '%}';
    })
    .join('');
}

/**
 * @returns {string}
 */
export function censoColgroupHtml() {
  return censoColumnPercents()
    .map(function (c) {
      var cls = c.key === 'paciente' ? 'pac' : c.key === 'meds' ? 'med' : c.key === 'labs' ? 'lab' : c.key;
      return '<col class="' + cls + '">';
    })
    .join('');
}

/**
 * @returns {string}
 */
export function censoTheadRowHtml() {
  return censoColumnPercents()
    .map(function (c) {
      var bold = c.key === 'dx' || c.key === 'cama' ? ' censo-bold' : '';
      return '<th class="censo-th' + bold + '">' + c.title + '</th>';
    })
    .join('');
}
