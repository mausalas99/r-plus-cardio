import {
  dedupeTrendSetsForSeries,
  getSetTrendValueForSeries,
} from '../tend-core.mjs';
import { openLabDisplayPrefsModal, closeLabDisplayPrefsModal, onLabDisplayPrefsChanged } from './tendencias-lab-prefs.mjs';
import { TEND_SERIES_CATALOG } from './tendencias-constants.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import { esc } from './tendencias-state.mjs';
import {
  tendCatalogSeriesKey,
  tendFindSeriesSpec,
  tendEyeVisibilitySvg,
  tendRefForSeries,
} from './tendencias-catalog.mjs';

var TEND_HIDDEN_SERIES_LS = 'rpc-tend-hidden-series';
var TEND_ABNORMAL_ONLY_LS = 'rpc-tend-abnormal-only';
function tendHiddenSeriesRead() {
  try {
    var j = localStorage.getItem(TEND_HIDDEN_SERIES_LS);
    if (!j) return [];
    var a = JSON.parse(j);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function tendHiddenSeriesWrite(arr) {
  try {
    localStorage.setItem(TEND_HIDDEN_SERIES_LS, JSON.stringify(arr || []));
  } catch (_e) { void _e; }
}

function tendSeriesIsUserHidden(sectionKey, fieldKey) {
  return tendHiddenSeriesRead().indexOf(tendCatalogSeriesKey(sectionKey, fieldKey)) !== -1;
}

function tendSeriesSetUserHidden(sectionKey, fieldKey, hidden) {
  var k = tendCatalogSeriesKey(sectionKey, fieldKey);
  var a = tendHiddenSeriesRead().slice();
  var i = a.indexOf(k);
  if (hidden && i === -1) a.push(k);
  if (!hidden && i !== -1) a.splice(i, 1);
  tendHiddenSeriesWrite(a);
}

function seedTendHiddenDefaults() {
  var SEED_KEY = 'rpc-tend-hidden-seeded-v2';
  try {
    if (localStorage.getItem(SEED_KEY) === '1') return;
  } catch {
    return;
  }
  var current = tendHiddenSeriesRead().slice();
  var seen = {};
  current.forEach(function (k) {
    seen[k] = true;
  });
  var changed = false;
  TEND_SERIES_CATALOG.forEach(function (sp) {
    if (sp && sp.hiddenByDefault) {
      var key = tendCatalogSeriesKey(sp.sectionKey, sp.fieldKey);
      if (!seen[key]) {
        current.push(key);
        seen[key] = true;
        changed = true;
      }
    }
  });
  try {
    if (changed) tendHiddenSeriesWrite(current);
    localStorage.setItem(SEED_KEY, '1');
  } catch (_e) { void _e; }
}

function tendAbnormalOnlyRead() {
  try {
    return localStorage.getItem(TEND_ABNORMAL_ONLY_LS) === '1';
  } catch {
    return false;
  }
}

function tendAbnormalOnlyWrite(on) {
  try {
    if (on) localStorage.setItem(TEND_ABNORMAL_ONLY_LS, '1');
    else localStorage.removeItem(TEND_ABNORMAL_ONLY_LS);
  } catch (_e) { void _e; }
}

function tendSeriesLatestAbnormal(history, sectionKey, fieldKey) {
  var raw = history.filter(function (s) {
    return getSetTrendValueForSeries(s, sectionKey, fieldKey) != null;
  });
  var setsDesc = dedupeTrendSetsForSeries(raw, sectionKey, fieldKey);
  if (setsDesc.length < 2) return false;
  var latestSet = setsDesc[0];
  var latest = getSetTrendValueForSeries(latestSet, sectionKey, fieldKey);
  var ref = tendRefForSeries(history, sectionKey, fieldKey, latestSet);
  return !!(ref && latest != null && (latest < ref[0] || latest > ref[1]));
}

function tendHiddenChipDescriptors() {
  var hiddenKeys = tendHiddenSeriesRead();
  var list = [];
  for (var hi = 0; hi < hiddenKeys.length; hi++) {
    var entry = hiddenKeys[hi];
    var pipe = entry.indexOf('|');
    if (pipe < 1) continue;
    var sk = entry.slice(0, pipe);
    var fk = entry.slice(pipe + 1);
    if (!fk) continue;
    list.push({ sectionKey: sk, fieldKey: fk });
  }
  return list;
}

function buildTendHiddenChipsHtml() {
  var desc = tendHiddenChipDescriptors();
  var svg = tendEyeVisibilitySvg();
  var chips = [];
  for (var i = 0; i < desc.length; i++) {
    var sk = desc[i].sectionKey;
    var fk = desc[i].fieldKey;
    var label = esc(tendFindSeriesSpec(sk, fk).cardTitle || fk);
    chips.push(
      '<button type="button" class="tend-hidden-chip" data-series-key="' +
      esc(tendCatalogSeriesKey(sk, fk)) +
      '" title="Volver a mostrar ' +
      label +
      '" aria-label="Mostrar de nuevo ' +
      label +
      '">' +
      '<span class="tend-hidden-chip-label">' +
      label +
      '</span>' +
      '<span class="tend-hidden-chip-eye" aria-hidden="true">' +
      svg +
      '</span></button>'
    );
  }
  return chips.join('');
}

function refreshTendHiddenModalContent() {
  var el = document.getElementById('tend-hidden-modal-chips');
  if (!el) return;
  var html = buildTendHiddenChipsHtml();
  el.innerHTML =
    html ||
    '<p style="margin:0;font-size:13px;color:var(--text-muted);">No hay analitos ocultos.</p>';
}

function openTendHiddenModal() {
  var bd = document.getElementById('tend-hidden-modal-backdrop');
  if (!bd) return;
  refreshTendHiddenModalContent();
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
}

export function closeTendHiddenModal() {
  var bd = document.getElementById('tend-hidden-modal-backdrop');
  if (!bd) return;
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
}

function buildTendInlineControlsHtml(hiddenCount, opts) {
  opts = opts || {};
  var on = tendAbnormalOnlyRead();
  var hint = on
    ? 'Solo analitos con último valor fuera del rango de referencia del laboratorio (si hay referencia).'
    : 'Vista completa: todos los analitos con datos suficientes para tendencia.';
  var toggleLabel = on ? 'Ver todas' : 'Solo fuera de rango';
  var ocultosBtn =
    hiddenCount > 0
      ? '<button type="button" class="tend-toolbar-btn tend-ocultos-trigger">Ocultos (' +
        hiddenCount +
        ')</button>'
      : '';
  var gasoBtn = opts.showGasoExtended
    ? '<button type="button" class="tend-toolbar-btn tend-gaso-ext-trigger" data-tend-action="gaso-extended">Gasometría extendida</button>'
    : '';
  return (
    '<div class="tend-inline-controls">' +
    '<button type="button" class="tend-toolbar-toggle' +
    (on ? ' is-active' : '') +
    '" aria-pressed="' +
    (on ? 'true' : 'false') +
    '" title="' +
    esc(hint) +
    '">' +
    esc(toggleLabel) +
    '</button>' +
    ocultosBtn +
    gasoBtn +
    '</div>'
  );
}

function historyHasGasoForExtended(historyDesc) {
  var latest = historyDesc && historyDesc[0];
  if (!latest || !latest.parsedBySection || !latest.parsedBySection.GASES) return false;
  return getSetTrendValueForSeries(latest, 'GASES', 'pH') != null;
}

function toggleTendAbnormalOnlyFilter() {
  tendAbnormalOnlyWrite(!tendAbnormalOnlyRead());
  tendenciasBridge.renderTendencias();
}

function tendHideSeriesFromCard(ev, sectionKey, fieldKey) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  tendSeriesSetUserHidden(sectionKey, fieldKey, true);
  tendenciasBridge.renderTendencias();
}

function tendUnhideSeries(sectionKey, fieldKey) {
  tendSeriesSetUserHidden(sectionKey, fieldKey, false);
  tendenciasBridge.renderTendencias();
}

function tendResetAllHiddenSeries() {
  tendHiddenSeriesWrite([]);
  closeTendHiddenModal();
  tendenciasBridge.renderTendencias();
}

export {
  tendHiddenSeriesRead,
  tendHiddenSeriesWrite,
  tendSeriesIsUserHidden,
  tendSeriesSetUserHidden,
  seedTendHiddenDefaults,
  tendAbnormalOnlyRead,
  tendAbnormalOnlyWrite,
  tendSeriesLatestAbnormal,
  tendHiddenChipDescriptors,
  buildTendHiddenChipsHtml,
  refreshTendHiddenModalContent,
  openTendHiddenModal,
  buildTendInlineControlsHtml,
  historyHasGasoForExtended,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
};
