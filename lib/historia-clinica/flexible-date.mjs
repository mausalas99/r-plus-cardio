/**
 * Partial clinical dates: year only, year-month, or full day.
 * @typedef {{ precision: 'year'|'month'|'day', year: number, month?: number, day?: number }} FlexibleDate
 */

import { normalizeFlexibleDateMonthDay } from './flexible-date-normalize.mjs';

export function formatFlexibleDate(d) {
  if (!d || d.year == null || !Number.isFinite(Number(d.year))) return '';
  const y = Number(d.year);
  const p = d.precision || 'year';
  if (p === 'year') return String(y);
  const m = Number(d.month);
  if (p === 'month' && m >= 1 && m <= 12) {
    return String(m).padStart(2, '0') + '/' + y;
  }
  const day = Number(d.day);
  if (p === 'day' && m >= 1 && m <= 12 && day >= 1 && day <= 31) {
    return (
      String(day).padStart(2, '0') +
      '/' +
      String(m).padStart(2, '0') +
      '/' +
      y
    );
  }
  return String(y);
}

/**
 * @param {Partial<FlexibleDate>} raw
 * @returns {FlexibleDate|null}
 */
export function normalizeFlexibleDate(raw) {
  if (!raw || raw.year == null) return null;
  const year = Number(raw.year);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  return normalizeFlexibleDateMonthDay(year, raw);
}

export function defaultFlexibleDate() {
  return { precision: 'year', year: new Date().getFullYear() };
}
