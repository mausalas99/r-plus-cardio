/**
 * @param {number} year
 * @param {Partial<import('./flexible-date.mjs').FlexibleDate>} raw
 * @returns {import('./flexible-date.mjs').FlexibleDate|null}
 */
export function normalizeFlexibleDateMonthDay(year, raw) {
  const precision =
    raw.precision === 'day' || raw.precision === 'month' || raw.precision === 'year'
      ? raw.precision
      : 'year';
  const out = { precision, year };
  if (precision === 'month' || precision === 'day') {
    const month = Number(raw.month);
    if (Number.isFinite(month) && month >= 1 && month <= 12) out.month = month;
    else if (precision !== 'year') return { precision: 'year', year };
  }
  if (precision === 'day') {
    const day = Number(raw.day);
    if (Number.isFinite(day) && day >= 1 && day <= 31) out.day = day;
    else return { precision: 'month', year: out.year, month: out.month };
  }
  return out;
}
