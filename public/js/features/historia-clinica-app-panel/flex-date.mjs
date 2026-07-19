import { normalizeFlexibleDate, defaultFlexibleDate } from '../../../../lib/historia-clinica/flexible-date.mjs';
import { esc } from './runtime.mjs';

export function flexibleDateHtml(prefix, date) {
  const d = normalizeFlexibleDate(date) || defaultFlexibleDate();
  const p = d.precision || 'year';
  return (
    '<div class="hc-flex-date" data-flex-prefix="' +
    esc(prefix) +
    '">' +
    '<select class="hc-flex-precision" data-flex="precision" aria-label="Precisión de fecha">' +
    '<option value="year"' +
    (p === 'year' ? ' selected' : '') +
    '>Año</option>' +
    '<option value="month"' +
    (p === 'month' ? ' selected' : '') +
    '>Mes/Año</option>' +
    '<option value="day"' +
    (p === 'day' ? ' selected' : '') +
    '>Día completo</option>' +
    '</select>' +
    '<input type="number" class="hc-flex-year" data-flex="year" min="1900" max="2100" placeholder="Año" value="' +
    esc(d.year) +
    '">' +
    '<input type="number" class="hc-flex-month" data-flex="month" min="1" max="12" placeholder="Mes" value="' +
    esc(d.month != null ? d.month : '') +
    '"' +
    (p === 'year' ? ' hidden' : '') +
    '>' +
    '<input type="number" class="hc-flex-day" data-flex="day" min="1" max="31" placeholder="Día" value="' +
    esc(d.day != null ? d.day : '') +
    '"' +
    (p !== 'day' ? ' hidden' : '') +
    '></div>'
  );
}

export function readFlexibleDate(wrap) {
  if (!wrap) return null;
  const precision = wrap.querySelector('[data-flex="precision"]').value;
  const year = Number(wrap.querySelector('[data-flex="year"]').value);
  const month = Number(wrap.querySelector('[data-flex="month"]').value);
  const day = Number(wrap.querySelector('[data-flex="day"]').value);
  return normalizeFlexibleDate({ precision, year, month, day });
}

export function wireFlexibleDate(wrap) {
  if (!wrap || wrap._hcFlexWired) return;
  wrap._hcFlexWired = true;
  const prec = wrap.querySelector('[data-flex="precision"]');
  const monthEl = wrap.querySelector('[data-flex="month"]');
  const dayEl = wrap.querySelector('[data-flex="day"]');
  prec.addEventListener('change', function () {
    const p = prec.value;
    monthEl.hidden = p === 'year';
    dayEl.hidden = p !== 'day';
  });
}
