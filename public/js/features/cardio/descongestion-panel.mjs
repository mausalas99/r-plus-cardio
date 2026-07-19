import { ensureCardio } from '../../../../lib/cardio/patient-cardio.mjs';
import {
  computeDescongestion,
  applyAcumuladoOverride,
  clearAcumuladoOverride,
} from '../../../../lib/cardio/descongestion.mjs';
import { listActiveMeds, sumFurosemidaMg } from '../../../../lib/cardio/med-segments.mjs';
import { accesoFechaToDateInputValue } from '../../patient-date-fields.mjs';
import { ioDiuresisForBalance } from '../estado-actual-io.mjs';
import { saveState } from '../../app-state.mjs';
import { escHtml, escAttr } from '../../dom-escape.mjs';

/** @param {Date} [d] */
export function localYmd(d) {
  var dt = d instanceof Date ? d : new Date();
  if (Number.isNaN(dt.getTime())) return '';
  var y = dt.getFullYear();
  var m = String(dt.getMonth() + 1).padStart(2, '0');
  var day = String(dt.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** @param {unknown} iso */
export function recordedAtToLocalYmd(iso) {
  if (!iso) return '';
  var d = new Date(String(iso));
  return localYmd(d);
}

/**
 * Daily diuresis (ml) from EA historial, one sum per calendar day (local).
 * @param {Record<string, unknown> | null | undefined} monitoreo
 * @returns {number[]}
 */
export function extractDailyDiuresisMl(monitoreo) {
  var hist = monitoreo && Array.isArray(monitoreo.historial) ? monitoreo.historial : [];
  /** @type {Map<string, number>} */
  var byDay = new Map();
  for (var i = 0; i < hist.length; i++) {
    var row = hist[i];
    if (!row) continue;
    var ymd = recordedAtToLocalYmd(row.recordedAt);
    if (!ymd) continue;
    var raw = ioDiuresisForBalance(row.io);
    var n = Number(raw);
    if (!Number.isFinite(n)) continue;
    byDay.set(ymd, (byDay.get(ymd) || 0) + n);
  }
  return Array.from(byDay.entries())
    .sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    })
    .map(function (e) {
      return e[1];
    });
}

/**
 * @param {Record<string, unknown> | null | undefined} patient
 * @returns {string}
 */
export function resolveIngresoYmd(patient) {
  if (!patient) return '';
  return (
    accesoFechaToDateInputValue(patient.fimiFecha) ||
    accesoFechaToDateInputValue(patient.fiuxFecha) ||
    ''
  );
}

/**
 * Active meds for EA read-only list: open segments + fantásticos with a drug.
 * @param {Record<string, unknown>} cardio
 * @returns {Array<{ label: string, dosis: string }>}
 */
export function collectActiveMedRows(cardio) {
  /** @type {Array<{ label: string, dosis: string }>} */
  var rows = [];
  var segs = listActiveMeds(
    [].concat(cardio.medSegments || [], cardio.diureticSegments || [])
  );
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (!s) continue;
    rows.push({
      label: String(s.tipo || '').trim() || 'Medicamento',
      dosis: String(s.dosis || '').trim(),
    });
  }
  var fant = Array.isArray(cardio.fantasticos) ? cardio.fantasticos : [];
  for (var j = 0; j < fant.length; j++) {
    var f = fant[j];
    if (!f) continue;
    var drug = String(f.drug || '').trim();
    if (!drug) continue;
    var className = String(f.className || '').trim();
    rows.push({
      label: className ? className + ' · ' + drug : drug,
      dosis: String(f.dosis || '').trim(),
    });
  }
  return rows;
}

/**
 * @param {{
 *   ingresoDate: string,
 *   inicioDescongestion: string,
 *   diasInternamiento: number,
 *   diasDescongestion: number,
 *   diuresisAcumuladaMl: number,
 *   furosemidaAcumuladaMg: number,
 *   diuresisOverridden?: boolean,
 *   furosemidaOverridden?: boolean,
 *   activeMeds?: Array<{ label: string, dosis: string }>,
 * }} vm
 */
export function buildDescongestionHeaderHtml(vm) {
  var meds = Array.isArray(vm.activeMeds) ? vm.activeMeds : [];
  var medsHtml =
    meds.length === 0
      ? '<p class="ea-muted ea-cardio-meds-empty">Sin medicamentos activos en Manejo.</p>'
      : '<ul class="ea-cardio-meds-list">' +
        meds
          .map(function (m) {
            var dose = m.dosis ? ' — ' + escHtml(m.dosis) : '';
            return '<li><span class="ea-cardio-med-name">' + escHtml(m.label) + '</span>' + dose + '</li>';
          })
          .join('') +
        '</ul>';

  return (
    '<section class="ea-section ea-card ea-cardio-descongestion" data-ea-cardio-descongestion-panel="1">' +
    '<h3 class="ea-section-title">Descongestión</h3>' +
    '<div class="ea-cardio-grid">' +
    '<div class="ea-field">' +
    '<label class="ea-label" for="ea-cardio-inicio-descongestion">Inicio descongestión</label>' +
    '<input type="date" class="ea-input" id="ea-cardio-inicio-descongestion" data-ea-cardio-inicio ' +
    'value="' +
    escAttr(vm.inicioDescongestion || '') +
    '">' +
    '</div>' +
    '<div class="ea-field">' +
    '<span class="ea-label">Días de internamiento</span>' +
    '<div class="ea-input ea-input--readonly" aria-live="polite">' +
    escHtml(String(vm.diasInternamiento || 0)) +
    '</div>' +
    '</div>' +
    '<div class="ea-field">' +
    '<span class="ea-label">Días en descongestión</span>' +
    '<div class="ea-input ea-input--readonly" aria-live="polite">' +
    escHtml(String(vm.diasDescongestion || 0)) +
    '</div>' +
    '</div>' +
    '<div class="ea-field ea-cardio-acum">' +
    '<label class="ea-label" for="ea-cardio-diuresis-acum">Diuresis acumulada (ml)' +
    (vm.diuresisOverridden ? ' <span class="ea-cardio-override-badge">manual</span>' : '') +
    '</label>' +
    '<div class="ea-cardio-acum-row">' +
    '<input type="number" class="ea-input" id="ea-cardio-diuresis-acum" data-ea-cardio-diuresis-acum ' +
    'step="1" value="' +
    escAttr(String(vm.diuresisAcumuladaMl ?? '')) +
    '">' +
    '<button type="button" class="ea-btn ea-btn--ghost" data-ea-cardio-recalc="diuresisAcumuladaMl">Recalcular</button>' +
    '</div>' +
    '</div>' +
    '<div class="ea-field ea-cardio-acum">' +
    '<label class="ea-label" for="ea-cardio-furosemida-acum">Furosemida acumulada (mg)' +
    (vm.furosemidaOverridden ? ' <span class="ea-cardio-override-badge">manual</span>' : '') +
    '</label>' +
    '<div class="ea-cardio-acum-row">' +
    '<input type="number" class="ea-input" id="ea-cardio-furosemida-acum" data-ea-cardio-furosemida-acum ' +
    'step="1" value="' +
    escAttr(String(vm.furosemidaAcumuladaMg ?? '')) +
    '">' +
    '<button type="button" class="ea-btn ea-btn--ghost" data-ea-cardio-recalc="furosemidaAcumuladaMg">Recalcular</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="ea-cardio-meds">' +
    '<h4 class="ea-snapshot-zone-title">Medicamentos activos</h4>' +
    medsHtml +
    '</div>' +
    '</section>'
  );
}

/**
 * @param {HTMLElement | null} mount
 * @param {Record<string, unknown> | null | undefined} patient
 */
export function mountDescongestionPanel(mount, patient) {
  if (!mount || !patient) return;
  ensureCardio(patient);
  /** @type {any} */
  var cardio = patient.cardio;
  var asOf = localYmd();
  var ingresoDate = resolveIngresoYmd(patient);
  var dailyDiuresis = extractDailyDiuresisMl(patient.monitoreo);
  var furoMg = sumFurosemidaMg(cardio.diureticSegments);
  var computed = computeDescongestion({
    ingresoDate: ingresoDate,
    asOfDate: asOf,
    inicioDescongestion: cardio.inicioDescongestion || '',
    dailyDiuresisMl: dailyDiuresis,
    furosemidaAcumuladaMg: furoMg,
    overrides: cardio.overrides || {},
  });
  var overrides = cardio.overrides || {};
  mount.innerHTML = buildDescongestionHeaderHtml({
    ingresoDate: ingresoDate,
    inicioDescongestion: cardio.inicioDescongestion || '',
    diasInternamiento: computed.diasInternamiento,
    diasDescongestion: computed.diasDescongestion,
    diuresisAcumuladaMl: computed.diuresisAcumuladaMl,
    furosemidaAcumuladaMg: computed.furosemidaAcumuladaMg,
    diuresisOverridden: overrides.diuresisAcumuladaMl != null,
    furosemidaOverridden: overrides.furosemidaAcumuladaMg != null,
    activeMeds: collectActiveMedRows(cardio),
  });
  wireDescongestionPanel(mount, patient);
}

/**
 * @param {HTMLElement} mount
 * @param {Record<string, unknown>} patient
 */
function wireDescongestionPanel(mount, patient) {
  var inicioEl = mount.querySelector('[data-ea-cardio-inicio]');
  if (inicioEl) {
    inicioEl.addEventListener('change', function () {
      ensureCardio(patient);
      /** @type {any} */
      var c = patient.cardio;
      c.inicioDescongestion = String(inicioEl.value || '').trim();
      saveState();
      mountDescongestionPanel(mount, patient);
    });
  }

  var diuresisEl = mount.querySelector('[data-ea-cardio-diuresis-acum]');
  if (diuresisEl) {
    diuresisEl.addEventListener('change', function () {
      applyOverrideFromInput(patient, 'diuresisAcumuladaMl', diuresisEl.value);
      saveState();
      mountDescongestionPanel(mount, patient);
    });
  }

  var furoEl = mount.querySelector('[data-ea-cardio-furosemida-acum]');
  if (furoEl) {
    furoEl.addEventListener('change', function () {
      applyOverrideFromInput(patient, 'furosemidaAcumuladaMg', furoEl.value);
      saveState();
      mountDescongestionPanel(mount, patient);
    });
  }

  mount.querySelectorAll('[data-ea-cardio-recalc]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-ea-cardio-recalc');
      if (!key) return;
      ensureCardio(patient);
      /** @type {any} */
      var c = patient.cardio;
      var next = clearAcumuladoOverride(c, key);
      c.overrides = next.overrides;
      saveState();
      mountDescongestionPanel(mount, patient);
    });
  });
}

/**
 * @param {Record<string, unknown>} patient
 * @param {string} key
 * @param {unknown} raw
 */
function applyOverrideFromInput(patient, key, raw) {
  ensureCardio(patient);
  /** @type {any} */
  var c = patient.cardio;
  var n = Number(raw);
  if (!Number.isFinite(n)) return;
  var next = applyAcumuladoOverride(c, key, n);
  c.overrides = next.overrides;
}
