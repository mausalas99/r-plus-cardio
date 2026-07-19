import { rowSomePharmCategory } from '../med-pharm-some-catalog.mjs';
import { formatFreqShort, formatViaShort } from '../med-pharm-profile-core.mjs';
import { adherenceStatsForRowKeys } from '../med-pharm-view-window.mjs';
import {
  esc,
  formatViaListAbbrev,
  medGroupListTooltip,
  isMedPharmGroupHidden,
} from './med-pharm-profile-state.mjs';
import {
  buildAdhTriggerHtmlForGroup,
  wireMedPharmAdhHoverPanels,
} from './med-pharm-profile-adh.mjs';
import {
  openMedPharmPasteModal,
  openMedPharmMedGroupModal,
} from './med-pharm-profile-modals.mjs';

export function updateMedPharmLastPasteEl(lastPasteEl, month) {
  if (!lastPasteEl) return;
  var pasted = month && month.lastSomePasteAt;
  if (!pasted) {
    lastPasteEl.hidden = true;
    return;
  }
  var d = new Date(pasted);
  lastPasteEl.textContent =
    'Último pegado: ' +
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear();
  lastPasteEl.hidden = false;
}

export function renderMedPharmNoPatientState(hint, list) {
  if (hint) {
    hint.style.display = 'block';
    hint.textContent = 'Selecciona un paciente para ver el perfil farmacoterapéutico.';
  }
  list.innerHTML = '';
}

export function renderMedPharmEmptyColumns(list, window, card, listHead) {
  if (card) card.classList.remove('med-pharm-has-grid');
  if (listHead) listHead.style.display = '';
  list.className = 'med-pharm-list-body';
  list.innerHTML =
    '<div class="med-pharm-empty">' +
    '<p class="med-pharm-empty-title">Sin datos para ' +
    esc(window.label) +
    '</p>' +
    '<p class="med-pharm-empty-lead">Importa la matriz SOME del hospital o procesa <strong>Receta</strong> en la pestaña Manejo actual.</p>' +
    '<button type="button" class="btn-generate" data-med-pharm-open-paste>Importar mes SOME</button>' +
    '</div>';
  list.querySelector('[data-med-pharm-open-paste]').addEventListener('click', openMedPharmPasteModal);
}

export function renderMedPharmEmptyFilter(list, hiddenCount, card, listHead, showHiddenMedRows) {
  if (card) card.classList.remove('med-pharm-has-grid');
  if (listHead) listHead.style.display = hiddenCount > 0 && showHiddenMedRows ? '' : 'none';
  list.className = 'med-pharm-list-body';
  list.innerHTML =
    '<div class="med-pharm-empty med-pharm-empty--filter">' +
    '<p class="med-pharm-empty-title">Ningún medicamento visible</p>' +
    '<p class="med-pharm-empty-lead">' +
    (hiddenCount > 0
      ? 'Hay ' + hiddenCount + ' oculto(s) con este filtro. Activa <strong>Mostrar ocultos</strong> para verlos o restaurarlos.'
      : 'Prueba otro filtro de categoría.') +
    '</p>' +
    '</div>';
}

function medPharmRowKeysAttr(group) {
  return group.rowKeys.join('\t');
}

function buildMedPharmNameRow(group, current, stats, columns, profile, windowLabel) {
  var multiRegimen = group.variants.length > 1;
  var nameRow = document.createElement('div');
  nameRow.className = 'med-pharm-name-row';
  var nameEl = document.createElement('div');
  nameEl.className = 'med-pharm-name';
  nameEl.textContent = group.med || '';
  nameRow.appendChild(nameEl);
  var catEl = document.createElement('span');
  catEl.className = 'med-pharm-cat-badge';
  catEl.textContent = rowSomePharmCategory(current);
  nameRow.appendChild(catEl);
  if (multiRegimen) {
    var regEl = document.createElement('span');
    regEl.className = 'med-pharm-regimen-badge';
    regEl.textContent = '×' + group.variants.length;
    regEl.title = group.variants.length + ' regímenes — ver en Días';
    nameRow.appendChild(regEl);
  }
  var adhEl = document.createElement('div');
  adhEl.className = 'med-cell-adh';
  adhEl.innerHTML = buildAdhTriggerHtmlForGroup(group, stats, columns, profile, windowLabel);
  nameRow.appendChild(adhEl);
  return { nameRow: nameRow, multiRegimen: multiRegimen };
}

function buildMedPharmRowActions(group, isHidden, multiRegimen) {
  var actions = document.createElement('div');
  actions.className = 'med-pharm-row-actions';
  var btnDays = document.createElement('button');
  btnDays.type = 'button';
  btnDays.className = 'med-pharm-btn-dias';
  btnDays.textContent = 'Días';
  btnDays.title = multiRegimen
    ? 'Ver calendario con todas las dosis de este medicamento'
    : 'Ver calendario del medicamento';
  btnDays.addEventListener('click', function (e) {
    e.stopPropagation();
    openMedPharmMedGroupModal(group.medGroupKey);
  });
  actions.appendChild(btnDays);
  var btnVis = document.createElement('button');
  btnVis.type = 'button';
  btnVis.className = 'med-pharm-btn-visibility';
  var rowKeys = medPharmRowKeysAttr(group);
  if (isHidden) {
    btnVis.textContent = '↩';
    btnVis.setAttribute('aria-label', 'Mostrar en la lista');
    btnVis.title = 'Volver a mostrar en la lista y calendario';
    btnVis.dataset.medPharmUnhideGroup = rowKeys;
  } else {
    btnVis.textContent = '×';
    btnVis.setAttribute('aria-label', 'Ocultar de la lista');
    btnVis.title = 'Ocultar de la vista (se conserva en el mes importado)';
    btnVis.dataset.medPharmHideGroup = rowKeys;
    btnVis.classList.add('med-pharm-btn-visibility--icon');
  }
  actions.appendChild(btnVis);
  return actions;
}

function buildMedPharmSummaryRow(group, columns, profile, windowLabel) {
  var current = group.currentVariant;
  var stats = adherenceStatsForRowKeys(profile, group.rowKeys, columns);
  var missCls = stats.missed > 0 ? ' has-misses' : '';
  var isHidden = isMedPharmGroupHidden(group);
  var wrap = document.createElement('div');
  wrap.className = 'med-pharm-row' + (isHidden ? ' med-pharm-row--hidden' : '');
  var summary = document.createElement('div');
  summary.className = 'med-pharm-row-summary' + missCls;
  summary.title = medGroupListTooltip(group);
  var main = document.createElement('div');
  main.className = 'med-pharm-main med-pharm-main--compact';
  var nameParts = buildMedPharmNameRow(group, current, stats, columns, profile, windowLabel);
  main.appendChild(nameParts.nameRow);
  summary.appendChild(main);
  summary.appendChild(buildMedPharmRowActions(group, isHidden, nameParts.multiRegimen));
  var freqEl = document.createElement('span');
  freqEl.className = 'med-pharm-freq-cell';
  freqEl.textContent = formatFreqShort(current.freq);
  summary.appendChild(freqEl);
  var viaEl = document.createElement('span');
  viaEl.className = 'med-pharm-via-cell';
  viaEl.textContent = formatViaListAbbrev(current.via);
  viaEl.title = formatViaShort(current.via);
  summary.appendChild(viaEl);
  wrap.appendChild(summary);
  return wrap;
}

export function renderMedPharmSummaryList(listEl, groups, window, profile) {
  var columns = window.columns;
  listEl.innerHTML = '';
  groups.forEach(function (group) {
    listEl.appendChild(buildMedPharmSummaryRow(group, columns, profile, window.label));
  });
  wireMedPharmAdhHoverPanels(listEl);
}
