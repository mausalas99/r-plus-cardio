/**
 * Egreso segment classification helpers.
 */

/** @param {(seg: string) => number|string|null} parseSegmentValue */
function classifyDiuresisSegment(s, parseSegmentValue) {
  if (/^NC$/i.test(s) || /^no\s+cuantificad/i.test(s)) {
    return { kind: 'diuresis', label: 'DIURESIS', value: 'NC' };
  }
  if (/^DIURESIS\b/i.test(s) || /^ORINA\b/i.test(s)) {
    const rest = s.replace(/^(?:DIURESIS|ORINA)\s*/i, '').trim();
    if (!rest || /no\s+cuantificad/i.test(rest)) {
      return { kind: 'diuresis', label: 'DIURESIS', value: rest ? parseSegmentValue(rest) : 'NC' };
    }
    return { kind: 'diuresis', label: 'DIURESIS', value: parseSegmentValue(rest) };
  }
  return null;
}

/** @param {string} s @param {(seg: string) => number|string|null} parseSegmentValue */
function classifyDrainSegment(s, parseSegmentValue) {
  if (!/DRENAJ/i.test(s.toUpperCase())) return null;
  const dRest = s.replace(/^DRENAJ(?:E|ES)?\s*/i, '').trim();
  return { kind: 'drain', label: 'DRENAJE', value: parseSegmentValue(dRest || s) };
}

/** @param {string} s @param {(seg: string) => number|string|null} parseSegmentValue */
function classifyGastrostomySegment(s, parseSegmentValue) {
  if (!/GASTROSTOM/i.test(s.toUpperCase())) return null;
  const gRest = s.replace(/^GASTROSTOM(?:ÍA|IA)?\s*/i, '').trim();
  return { kind: 'gastrostomy', label: 'GASTROSTOMÍA', value: parseSegmentValue(gRest || s) };
}

/** @param {string} s @param {(seg: string) => number|string|null} parseSegmentValue */
function classifyNephroSegment(s, parseSegmentValue) {
  const u = s.toUpperCase();
  if (!/NEFRO/i.test(u)) return null;
  let side = '';
  if (/IZQ|IZQUIERDA/i.test(u)) side = 'IZQUIERDA';
  else if (/\bDER\b|DERECHA/i.test(u)) side = 'DERECHA';
  let nRest = s.replace(/^NEFRO(?:STOM(?:ÍA|IA))?/i, '').trim();
  nRest = nRest.replace(/\b(IZQ|IZQUIERDA|DER|DERECHA)\b/gi, '').trim();
  const label = side ? 'NEFROSTOMÍA ' + side : 'NEFROSTOMÍA';
  return { kind: 'nephro', label, value: parseSegmentValue(nRest || s) };
}

/**
 * @param {string} seg
 * @param {(seg: string) => number|string|null} parseSegmentValue
 * @param {(seg: string) => number|null} parseIoNumber
 */
export function classifyEgresoSegmentKind(seg, parseSegmentValue, parseIoNumber) {
  const s = String(seg || '').trim();
  const diuresis = classifyDiuresisSegment(s, parseSegmentValue);
  if (diuresis) return diuresis;
  const drain = classifyDrainSegment(s, parseSegmentValue);
  if (drain) return drain;
  const gastrostomy = classifyGastrostomySegment(s, parseSegmentValue);
  if (gastrostomy) return gastrostomy;
  const nephro = classifyNephroSegment(s, parseSegmentValue);
  if (nephro) return nephro;

  const n = parseIoNumber(s);
  if (n != null) return { kind: 'diuresis', label: 'DIURESIS', value: n };
  if (/no\s+cuantificad/i.test(s)) return { kind: 'diuresis', label: 'DIURESIS', value: 'NC' };
  return { kind: 'diuresis', label: 'DIURESIS', value: s.toUpperCase() };
}

/**
 * @param {object} io
 * @param {(part: object) => string} formatEgresoPartForText
 * @param {(raw: unknown) => unknown} legacyEgrToParts
 * @param {(raw: unknown) => unknown} normalizeIoNcAbbrev
 * @param {(val: unknown) => boolean} isIoNumericValue
 * @param {(evac: unknown) => string} formatEvacForText
 * @param {(io: object) => boolean} isIoBalanceNc
 * @param {(ing: unknown, io: object) => number|null} computeIoBalanceFromIngEgr
 */
export function buildIoSoapClauses(io, helpers) {
  const clauses = ['INGRESOS ' + (io.ing != null && io.ing !== '' ? String(io.ing) : '___') + ' CC'];
  const parts = Array.isArray(io.egrParts) && io.egrParts.length ? io.egrParts : helpers.legacyEgrToParts(io.egr);
  if (parts.length) {
    for (let i = 0; i < parts.length; i += 1) clauses.push(helpers.formatEgresoPartForText(parts[i]));
  } else if (io.egr != null && io.egr !== '') {
    const egrNorm = helpers.normalizeIoNcAbbrev(io.egr);
    if (helpers.isIoNumericValue(egrNorm)) clauses.push('DIURESIS ' + String(egrNorm) + ' CC');
    else if (egrNorm === 'NC') clauses.push('DIURESIS NC');
    else clauses.push(String(egrNorm).toUpperCase());
  } else {
    clauses.push('DIURESIS ___');
  }
  if (io.evac != null && io.evac !== '') clauses.push('EVACUACIONES ' + helpers.formatEvacForText(io.evac));
  return clauses;
}

/** @param {object} io @param {unknown} balanceTurno @param {object} helpers */
export function buildIoSoapBalanceClause(io, balanceTurno, helpers) {
  if (helpers.isIoBalanceNc(io)) return 'BALANCE NC';
  let balNum = NaN;
  if (balanceTurno != null && balanceTurno !== '' && Number.isFinite(Number(balanceTurno))) {
    balNum = Number(balanceTurno);
  } else {
    const fromIo = helpers.computeIoBalanceFromIngEgr(io.ing, io);
    if (Number.isFinite(fromIo)) balNum = fromIo;
  }
  const balance = Number.isFinite(balNum) ? (balNum > 0 ? '+' : '') + balNum : '___';
  return 'BALANCE ' + balance + ' CC';
}
