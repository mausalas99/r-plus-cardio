function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const SOPORTE_SUFFIX = {
  'Aire ambiente': 'AA',
  'Puntillas nasales': 'LN',
  'Alto flujo': 'AF',
  'VM no invasiva': 'VMNI',
  Traqueostomía: 'TQT',
};

/**
 * @param {Record<string, unknown>} v
 * @param {Record<string, string>} alt
 * @param {string[]} parts
 */
export function appendTempFcFrLines(v, alt, parts) {
  const temp = num(v.temp);
  if (temp != null) {
    let line = 'TEMP ' + temp + ' °C';
    if (alt.temp) line += ' @ ' + alt.temp;
    const peak = num(v.tempPeak);
    if (peak != null) {
      line += ' (PICO ' + peak + ' °C';
      if (alt.tempPeak) line += ' @ ' + alt.tempPeak;
      line += ')';
    }
    parts.push(line);
  }

  const fc = num(v.fc);
  if (fc != null) parts.push('FC ' + fc + ' LPM');

  const fr = num(v.fr);
  if (fr != null) parts.push('FR ' + fr + ' RPM');
}

/**
 * @param {Record<string, unknown>} v
 * @param {{ soporte?: unknown } | null | undefined} estadoClinico
 * @param {string[]} parts
 */
export function appendSatTaLines(v, estadoClinico, parts) {
  const sat = num(v.sat);
  if (sat != null) {
    let satLine = 'SAT ' + sat + '%';
    const soporteKey =
      estadoClinico && estadoClinico.soporte != null ? String(estadoClinico.soporte).trim() : '';
    const soporteShort = SOPORTE_SUFFIX[soporteKey];
    if (soporteShort) satLine += ' ' + soporteShort;
    parts.push(satLine);
  }

  const tas = num(v.tas);
  const tad = num(v.tad);
  if (tas != null || tad != null) {
    parts.push('TA ' + (tas != null ? tas : '—') + '/' + (tad != null ? tad : '—') + ' MMHG');
  }
}

/**
 * @param {object} snapshot
 * @param {string[]} parts
 */
export function appendGluBombaLines(snapshot, parts) {
  const glu = Array.isArray(snapshot && snapshot.glucometrias) ? snapshot.glucometrias : [];
  if (glu.length) {
    parts.push(
      'DXT ' +
        glu
          .map(function (g) {
            const val = g && g.value != null ? String(g.value) : '';
            const time = g && g.time ? String(g.time) : '';
            return val + (time ? '@' + time : '');
          })
          .filter(Boolean)
          .join(', ') +
        ' MG/DL'
    );
  }

  const bomba = Array.isArray(snapshot && snapshot.bombaInsulina) ? snapshot.bombaInsulina : [];
  if (bomba.length) {
    parts.push(
      'BOMBA ' +
        bomba
          .map(function (b) {
            if (!b || typeof b !== 'object') return '';
            const val = num(b.value);
            if (val == null) return '';
            const units = num(b.units);
            const time = b.time ? String(b.time) : '';
            let s = String(val);
            if (units != null && units > 0) s += ' U/h ' + units;
            if (time) s += '@' + time;
            return s;
          })
          .filter(Boolean)
          .join(', ')
    );
  }
}
