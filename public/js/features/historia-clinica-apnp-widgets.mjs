import {
  calcTobaccoIndex,
  calcAlcoholBurden,
} from '../../../lib/historia-clinica/apnp-calculators.mjs';

import { esc } from '../dom-escape.mjs';
function numInput(name, value, label, attrs) {
  attrs = attrs || '';
  return (
    '<div class="field-group hc-calc-field">' +
    '<label>' +
    esc(label) +
    '</label>' +
    '<input type="number" min="0" step="1" data-hc-calc="' +
    esc(name) +
    '" value="' +
    esc(value != null && value !== '' ? value : '') +
    '" ' +
    attrs +
    '></div>'
  );
}

function alertBanner(result, kind) {
  if (!result || !result.alert) return '';
  const msg =
    kind === 'tobacco'
      ? result.alert === 'high'
        ? 'Índice tabáquico elevado (≥40 paquetes-año). Considerar riesgo pulmonar/cardiovascular aumentado.'
        : 'Índice tabáquico moderado-alto (≥20 paquetes-año).'
      : result.alert === 'high'
        ? 'Consumo de alcohol de riesgo alto (≥210 g etanol/semana).'
        : 'Consumo de alcohol en rango de riesgo (≥140 g/semana).';
  return (
    '<div class="hc-calc-alert hc-calc-alert--' +
    esc(result.alert) +
    '" role="status">' +
    esc(msg) +
    '</div>'
  );
}

/**
 * @param {string} name
 * @param {string} value
 * @param {Array<[string, string]>} options
 */
function statusSelectRow(name, value, options) {
  const v = value || 'negado';
  return (
    '<div class="hc-calc-status-row">' +
    '<label class="hc-calc-status-row__label">Estatus</label>' +
    '<select class="hc-calc-status-row__select" data-hc-calc="' +
    esc(name) +
    '">' +
    options
      .map(function (pair) {
        return (
          '<option value="' +
          esc(pair[0]) +
          '"' +
          (v === pair[0] ? ' selected' : '') +
          '>' +
          esc(pair[1]) +
          '</option>'
        );
      })
      .join('') +
    '</select></div>'
  );
}

function statusSelect(name, value) {
  return statusSelectRow(name, value, [
    ['negado', 'Negado'],
    ['activo', 'Activo'],
    ['exfumador', 'Exfumador'],
  ]);
}

function alcoholStatusSelect(value) {
  return statusSelectRow('status', value, [
    ['negado', 'Negado'],
    ['activo', 'Consumo actual'],
  ]);
}

function shouldShowCalcSummary(summary, showFields) {
  if (showFields) return true;
  const s = String(summary || '').trim();
  return s.length > 0 && s !== 'Negado';
}

/**
 * @param {HTMLElement} container
 * @param {object} detail
 * @param {{ currentAge?: number }} ctx
 * @param {(nextDetail: object, summary: string) => void} onChange
 */
export function mountTabaquismoWidget(container, detail, ctx, onChange) {
  if (!container) return;
  detail = detail || { status: 'negado' };
  const result = calcTobaccoIndex(
    Object.assign({}, detail, { currentAge: ctx && ctx.currentAge })
  );
  const showFields = detail.status && detail.status !== 'negado';

  container.innerHTML =
    '<div class="hc-calc-card" data-hc-calc-kind="tabaquismo">' +
    statusSelect('status', detail.status) +
    (showFields
      ? '<div class="hc-calc-grid">' +
        numInput('ageStarted', detail.ageStarted, 'Edad de inicio') +
        numInput('cigarettesPerDay', detail.cigarettesPerDay, 'Cigarrillos por día') +
        numInput('yearsSmoked', detail.yearsSmoked, 'Años fumando (si sigue activo)') +
        (detail.status === 'exfumador'
          ? numInput('ageStopped', detail.ageStopped, 'Edad al dejar de fumar')
          : '') +
        '</div>'
      : '') +
    alertBanner(result, 'tobacco') +
    (shouldShowCalcSummary(result.summary, showFields)
      ? '<p class="hc-calc-result">' + esc(result.summary) + '</p>'
      : '') +
    '</div>';

  function readDetail() {
    const statusEl = container.querySelector('[data-hc-calc="status"]');
    const status = statusEl ? statusEl.value : 'negado';
    const out = { status };
    container.querySelectorAll('[data-hc-calc]').forEach(function (el) {
      const key = el.getAttribute('data-hc-calc');
      if (key === 'status') return;
      const n = Number(el.value);
      if (Number.isFinite(n)) out[key] = n;
    });
    return out;
  }

  function emit() {
    const next = readDetail();
    const r = calcTobaccoIndex(
      Object.assign({}, next, { currentAge: ctx && ctx.currentAge })
    );
    onChange(next, r.summary);
    mountTabaquismoWidget(container, next, ctx, onChange);
  }

  container.querySelectorAll('select[data-hc-calc], input[data-hc-calc]').forEach(function (el) {
    el.addEventListener('change', emit);
    el.addEventListener('input', emit);
  });
}

/**
 * @param {HTMLElement} container
 * @param {object} detail
 * @param {(nextDetail: object, summary: string) => void} onChange
 */
export function mountAlcoholismoWidget(container, detail, onChange) {
  if (!container) return;
  detail = detail || { status: 'negado' };
  const result = calcAlcoholBurden(detail);
  const showFields = detail.status && detail.status !== 'negado';
  const freq = detail.frequencyKind || 'semana';

  container.innerHTML =
    '<div class="hc-calc-card" data-hc-calc-kind="alcohol">' +
    alcoholStatusSelect(detail.status) +
    (showFields
      ? '<div class="hc-calc-grid">' +
        numInput('ageStarted', detail.ageStarted, 'Edad de inicio') +
        numInput('drinksPerOccasion', detail.drinksPerOccasion, 'Bebidas estándar por ocasión') +
        '<div class="field-group"><label>Frecuencia</label><select data-hc-calc="frequencyKind">' +
        '<option value="dia"' +
        (freq === 'dia' ? ' selected' : '') +
        '>Diario</option>' +
        '<option value="semana"' +
        (freq === 'semana' ? ' selected' : '') +
        '>Por semana</option>' +
        '<option value="fin"' +
        (freq === 'fin' ? ' selected' : '') +
        '>Fines de semana</option>' +
        '<option value="mes"' +
        (freq === 'mes' ? ' selected' : '') +
        '>Mensual</option>' +
        '<option value="ocasional"' +
        (freq === 'ocasional' ? ' selected' : '') +
        '>Ocasional</option>' +
        '</select></div>' +
        numInput(
          'frequencyCount',
          detail.frequencyCount != null ? detail.frequencyCount : 1,
          freq === 'semana' ? 'Veces por semana' : 'Cantidad',
          freq === 'semana' ? '' : 'style="display:none"'
        ) +
        '</div>'
      : '') +
    alertBanner(result, 'alcohol') +
    (shouldShowCalcSummary(result.summary, showFields)
      ? '<p class="hc-calc-result">' + esc(result.summary) + '</p>'
      : '') +
    '</div>';

  function readDetail() {
    const statusEl = container.querySelector('[data-hc-calc="status"]');
    const out = { status: statusEl ? statusEl.value : 'negado' };
    container.querySelectorAll('[data-hc-calc]').forEach(function (el) {
      const key = el.getAttribute('data-hc-calc');
      if (key === 'status' || key === 'frequencyKind') {
        out[key] = el.value;
        return;
      }
      const n = Number(el.value);
      if (Number.isFinite(n)) out[key] = n;
    });
    return out;
  }

  function emit() {
    const next = readDetail();
    const r = calcAlcoholBurden(next);
    onChange(next, r.summary);
    mountAlcoholismoWidget(container, next, onChange);
  }

  container.querySelectorAll('select[data-hc-calc], input[data-hc-calc]').forEach(function (el) {
    el.addEventListener('change', emit);
    el.addEventListener('input', emit);
  });
}
