import { escapeHtml } from '../../dom-escape.mjs';
// Time select helpers for entrega procedures / vitals

/** @param {string|null|undefined} scheduledAt */
function formatHHmm(scheduledAt) {
  if (!scheduledAt) return '';
  const d = new Date(scheduledAt);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const m = String(scheduledAt).match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : '';
}

/** @param {string} hhmm */
function scheduledAtFromTimeInput(hhmm) {
  const t = String(hhmm || '').trim();
  if (!t) return null;
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** @returns {string} HH:mm */
function defaultProcedureTimeHHmm() {
  const d = new Date();
  let mins = Math.ceil(d.getMinutes() / 5) * 5;
  if (mins >= 60) {
    d.setHours(d.getHours() + 1);
    mins = 0;
  }
  d.setMinutes(mins, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** @param {string} hhmm */
function parseTimeParts(hhmm) {
  const t = formatHHmm(hhmm) || String(hhmm || '').trim();
  if (!t || !/^\d{1,2}:\d{1,2}$/.test(t)) return { hour: '', minute: '' };
  const [hour, minute] = t.split(':');
  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
  };
}

/**
 * @param {string} selected
 * @param {{ allowBlank?: boolean }} [opts]
 */
function buildHourSelectOptions(selected, opts = {}) {
  const allowBlank = opts.allowBlank !== false;
  let html = allowBlank ? '<option value="">—</option>' : '';
  for (let h = 0; h < 24; h += 1) {
    const v = String(h).padStart(2, '0');
    html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
  }
  return html;
}

/**
 * @param {string} selected
 * @param {{ allowBlank?: boolean }} [opts]
 */
function buildMinuteSelectOptions(selected, opts = {}) {
  const allowBlank = opts.allowBlank !== false;
  let html = allowBlank ? '<option value="">—</option>' : '';
  const stepSet = new Set();
  for (let m = 0; m < 60; m += 5) {
    const v = String(m).padStart(2, '0');
    stepSet.add(v);
    html += `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`;
  }
  if (selected && !stepSet.has(selected)) {
    html += `<option value="${selected}" selected>${selected}</option>`;
  }
  return html;
}

/**
 * @param {string|null|undefined} hhmm
 * @param {{
 *   hourName?: string,
 *   minuteName?: string,
 *   ariaLabel?: string,
 *   allowBlank?: boolean,
 *   picker?: boolean,
 *   wrapperId?: string,
 *   wrapperClass?: string,
 *   disabled?: boolean,
 * }} [opts]
 */
function buildTimeSelectMarkup(hhmm, opts = {}) {
  const resolved = hhmm || (opts.allowBlank === false ? defaultProcedureTimeHHmm() : '');
  const { hour, minute } = parseTimeParts(resolved);
  const hourName = opts.hourName || 'entrega-proc-hour';
  const minuteName = opts.minuteName || 'entrega-proc-minute';
  const ariaLabel = opts.ariaLabel || 'Hora programada';
  const selectOpts = { allowBlank: opts.allowBlank !== false };
  const disabled = opts.disabled ? ' disabled' : '';
  const wrapClass = [opts.picker ? 'entrega-time-picker' : 'entrega-time-combo', opts.wrapperClass]
    .filter(Boolean)
    .join(' ');
  const wrapId = opts.wrapperId ? ` id="${opts.wrapperId}"` : '';

  return `<div class="${wrapClass}"${wrapId} role="group" aria-label="${escapeHtml(ariaLabel)}">
    <div class="entrega-time-picker__part">
      <span class="entrega-time-picker__hint">H</span>
      <select name="${hourName}" class="profile-input entrega-time-select" aria-label="Hora"${disabled}>${buildHourSelectOptions(hour, selectOpts)}</select>
    </div>
    <span class="entrega-time-sep" aria-hidden="true">:</span>
    <div class="entrega-time-picker__part">
      <span class="entrega-time-picker__hint">M</span>
      <select name="${minuteName}" class="profile-input entrega-time-select" aria-label="Minutos"${disabled}>${buildMinuteSelectOptions(minute, selectOpts)}</select>
    </div>
  </div>`;
}

/** @param {ParentNode} formEl */
function readTimeFromForm(formEl) {
  const hour = String(formEl.querySelector('[name="entrega-proc-hour"]')?.value || '').trim();
  const minute = String(formEl.querySelector('[name="entrega-proc-minute"]')?.value || '').trim();
  if (!hour && !minute) return '';
  if (hour && minute) return `${hour}:${minute}`;
  if (hour) return `${hour}:00`;
  return `00:${minute}`;
}

export {
  formatHHmm,
  scheduledAtFromTimeInput,
  defaultProcedureTimeHHmm,
  buildTimeSelectMarkup,
  readTimeFromForm,
};
