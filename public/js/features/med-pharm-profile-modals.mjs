import { medPharmProfileByPatient, saveState } from '../app-state.mjs';
import {
  parseSomePharmMonthPaste,
  looksLikeSomePharmMonthPaste,
  applySomePasteToProfile,
  deleteMonthFromProfile,
} from '../med-pharm-profile-core.mjs';
import {
  unifyRowsForWindow,
  rowsForMedGroup,
} from '../med-pharm-view-window.mjs';
import { monthHasData, profileHasMonthData } from '../med-pharm-profile-core.mjs';
import { medPharmProfileBridge } from './med-pharm-profile-bridge.mjs';
import {
  mp,
  getProfile,
  getViewWindow,
  monthLabel,
  persistMedPharmProfile,
  closeMedPharmMoreMenu,
  displayRowsForWindow,
  countHiddenInCategoryFilter,
} from './med-pharm-profile-state.mjs';
import { mountSomeGrid, buildMedGroupModalSubtitle } from './med-pharm-profile-grid.mjs';

var MED_PHARM_MODAL_IDS = ['med-pharm-paste-modal', 'med-pharm-modal-one', 'med-pharm-modal-full'];

function closeModals() {
  MED_PHARM_MODAL_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      el.setAttribute('hidden', '');
      el.setAttribute('aria-hidden', 'true');
    }
  });
  document.body.classList.remove('rpc-med-pharm-modal-open');
  mp.openMedGroupKey = null;
}

function openMedPharmModal(id) {
  closeModals();
  var el = document.getElementById(id);
  if (!el) return;
  el.removeAttribute('hidden');
  el.setAttribute('aria-hidden', 'false');
  el.classList.add('open');
  document.body.classList.add('rpc-med-pharm-modal-open');
}

export function closeMedPharmModals() {
  closeModals();
}

export function wireMedPharmModalDismiss() {
  if (mp.dismissWired) return;
  mp.dismissWired = true;
  document.addEventListener(
    'keydown',
    function (ev) {
      if (ev.key !== 'Escape') return;
      var open = false;
      MED_PHARM_MODAL_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.classList.contains('open')) open = true;
      });
      if (!open) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeModals();
    },
    true
  );
  MED_PHARM_MODAL_IDS.forEach(function (id) {
    var bd = document.getElementById(id);
    if (!bd) return;
    bd.addEventListener('click', function (ev) {
      if (!bd.classList.contains('open')) return;
      if (ev.target === bd) closeModals();
    });
  });
}

export function onActivePatientChangedForPharm(pid) {
  if (pid === mp.lastPharmPanelPatientId) return;
  mp.lastPharmPanelPatientId = pid;
  closeModals();
}

export function openMedPharmPasteModal() {
  var pid = mp.rt.getActiveId();
  if (!pid) {
    mp.rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var ta = document.getElementById('med-pharm-paste');
  openMedPharmModal('med-pharm-paste-modal');
  if (ta) {
    var profile = getProfile(pid);
    ta.value = profile && profile.draftPaste ? profile.draftPaste : '';
    requestAnimationFrame(function () {
      ta.focus();
    });
  }
}

export function deleteMedPharmViewMonth() {
  closeMedPharmMoreMenu();
  var pid = mp.rt.getActiveId();
  if (!pid) {
    mp.rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var profile = getProfile(pid);
  if (!monthHasData(profile, mp.viewYear, mp.viewMonthIndex)) {
    mp.rt.showToast('No hay datos de este mes para eliminar', 'error');
    return;
  }
  var label = monthLabel(mp.viewYear, mp.viewMonthIndex);
  if (
    !confirm(
      '¿Eliminar el perfil farmacoterapéutico de ' +
        label +
        '? Las marcas de no administrado y el pegado SOME de ese mes se perderán.'
    )
  ) {
    return;
  }
  var next = deleteMonthFromProfile(profile, mp.viewYear, mp.viewMonthIndex);
  persistMedPharmProfile(pid, next);
  closeModals();
  saveState();
  medPharmProfileBridge.renderMedPharmProfilePanel();
  mp.rt.showToast('Mes eliminado del perfil', 'success');
}

export function deleteMedPharmProfileAll() {
  closeMedPharmMoreMenu();
  var pid = mp.rt.getActiveId();
  if (!pid) {
    mp.rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var profile = getProfile(pid);
  if (!profile || (!profileHasMonthData(profile) && !profile.draftPaste)) {
    mp.rt.showToast('No hay perfil farmacoterapéutico para borrar', 'error');
    return;
  }
  if (
    !confirm(
      '¿Borrar todo el perfil farmacoterapéutico de este paciente? Se eliminarán todos los meses importados y el borrador de pegado.'
    )
  ) {
    return;
  }
  delete medPharmProfileByPatient[pid];
  closeModals();
  saveState();
  medPharmProfileBridge.renderMedPharmProfilePanel();
  mp.rt.showToast('Perfil farmacoterapéutico borrado', 'success');
}

export function openMedPharmMedGroupModal(medGroupKey) {
  var pid = mp.rt.getActiveId();
  if (!pid) return;
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (!window.columns.length) return;
  var unified = unifyRowsForWindow(profile, window.columns);
  var variantRows = rowsForMedGroup(unified, medGroupKey);
  if (!variantRows.length) return;
  var body = document.getElementById('med-pharm-modal-one-body');
  var title = document.getElementById('med-pharm-modal-one-title');
  var sub = document.getElementById('med-pharm-modal-one-sub');
  if (!body) return;
  if (title) title.textContent = variantRows[0].med || 'Medicamento';
  if (sub) sub.textContent = buildMedGroupModalSubtitle(profile, window, variantRows);
  mountSomeGrid(window, variantRows, profile, body);
  openMedPharmModal('med-pharm-modal-one');
  mp.openMedGroupKey = medGroupKey;
}

export function openMedPharmFullModal() {
  var pid = mp.rt.getActiveId();
  if (!pid) {
    mp.rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var profile = getProfile(pid) || { months: {} };
  var window = getViewWindow(pid);
  if (!window.columns.length) {
    mp.rt.showToast('No hay datos del mes para mostrar', 'error');
    return;
  }
  var unified = unifyRowsForWindow(profile, window.columns);
  var rows = displayRowsForWindow(profile, window);
  if (!rows.length) {
    var hiddenN = countHiddenInCategoryFilter(unified);
    mp.rt.showToast(
      hiddenN > 0
        ? 'Solo hay medicamentos ocultos. Activa «Mostrar ocultos» para ver el calendario.'
        : 'No hay medicamentos en el filtro actual',
      'error'
    );
    return;
  }
  var body = document.getElementById('med-pharm-modal-full-body');
  var title = document.getElementById('med-pharm-modal-full-title');
  var sub = document.getElementById('med-pharm-modal-full-sub');
  if (!body) return;
  if (title) {
    title.textContent = 'Calendario farmacoterapéutico — ' + window.label;
  }
  if (sub) {
    var filtLabel = mp.listFilter === 'TODOS' ? 'Todos los medicamentos' : 'Filtro: ' + mp.listFilter;
    sub.textContent = filtLabel + ' · ' + rows.length + ' filas · formato matriz SOME';
    sub.hidden = false;
  }
  openMedPharmModal('med-pharm-modal-full');
  mountSomeGrid(window, rows, profile, body);
}

export function importMedPharmMonthPaste() {
  var pid = mp.rt.getActiveId();
  if (!pid) {
    mp.rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var ta = document.getElementById('med-pharm-paste');
  var raw = ta ? ta.value : '';
  if (!looksLikeSomePharmMonthPaste(raw)) {
    mp.rt.showToast('No parece un pegado SOME mensual (cabecera con días 01, 02…)', 'error');
    return;
  }
  var parsed = parseSomePharmMonthPaste(raw, { year: mp.viewYear, monthIndex: mp.viewMonthIndex });
  if (!parsed.rows.length) {
    mp.rt.showToast('No se encontraron filas de medicamento en el pegado', 'error');
    return;
  }
  var profile = getProfile(pid) || { months: {} };
  medPharmProfileByPatient[pid] = applySomePasteToProfile(profile, parsed);
  if (medPharmProfileByPatient[pid].draftPaste) delete medPharmProfileByPatient[pid].draftPaste;
  saveState();
  if (ta) ta.value = '';
  closeModals();
  medPharmProfileBridge.renderMedPharmProfilePanel();
  var msg = 'Mes importado (' + parsed.rows.length + ' medicamentos)';
  if (parsed.skipped > 0) msg += '. Omitidas ' + parsed.skipped + ' líneas.';
  mp.rt.showToast(msg, 'success');
}
