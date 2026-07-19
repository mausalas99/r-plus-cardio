import { patients, saveState } from '../app-state.mjs';
import {
  renderGuardiaCensusGrid,
  syncGuardiaCensusPanelVisibility,
  isClinicalScopeReadyForLanPatientApply,
} from '../clinical-access-runtime.mjs';
import { shouldEnforceTeamPatientMirror } from '../clinical-privileges.mjs';
import { isMobileWeb } from '../mobile-web.mjs';
import { isPaseMode } from './chrome.mjs';
import {
  buildPatientListZones,
  buildRondaNavIds,
  trySilentPatientListPatch,
  updatePatientListDomIncremental,
} from '../patient-list-incremental.mjs';
import {
  shouldVirtualizeActiveZone,
  mountPatientActiveZoneVirtual,
  destroyPatientActiveZoneVirtual,
  trySilentVirtualPatientListPatch,
} from '../patient-list-virtual.mjs';
import { rt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import {
  patientsVisibleInSidebar,
  patientMatchesSearch,
  reselectIfActivePatientHidden,
  getPatientSearchFilter,
  syncClinicalCensusFiltersBar,
} from './patients-scope.mjs';
import {
  renderPatientCardHtml,
  renderPinnedSectionLabelHtml,
  renderActiveSectionLabelHtml,
  renderArchivedToggleHtml,
} from './patients-card-html.mjs';
import {
  renderPatientRoundRowHtml,
  setLastRondaNavIds,
  isPatientRoundSeen,
} from './patients-round.mjs';

var ARCHIVED_SECTION_COLLAPSED_LS = 'rpc-archived-section-collapsed';
var _patientListSortables = [];

function ensurePatientUiState() {
  var changed = false;
  for (var i = 0; i < patients.length; i++) {
    var p = patients[i];
    if (!p) continue;
    if (typeof p.archived !== 'boolean') {
      p.archived = false;
      changed = true;
    }
    if (typeof p.pinned !== 'boolean') {
      p.pinned = false;
      changed = true;
    }
  }
  if (changed) saveState();
}

function isArchivedSectionCollapsed() {
  try {
    return localStorage.getItem(ARCHIVED_SECTION_COLLAPSED_LS) === '1';
  } catch {
    return false;
  }
}

export function setArchivedSectionCollapsed(v) {
  try {
    localStorage.setItem(ARCHIVED_SECTION_COLLAPSED_LS, v ? '1' : '0');
  } catch (_e) { void _e; }
}

export { isArchivedSectionCollapsed };

function destroyPatientListSortables() {
  _patientListSortables.forEach(function (s) {
    try {
      if (s && typeof s.destroy === 'function') s.destroy();
    } catch (_e) { void _e; }
  });
  _patientListSortables = [];
}

function handlePatientSortZoneEnd(evt) {
  if (evt.oldIndex === evt.newIndex || evt.from !== evt.to) return;
  syncPatientsOrderFromDom();
  saveState();
}

function mountPatientListSortables() {
  destroyPatientListSortables();
  if (isMobileWeb()) return;
  var SortableCtor = typeof globalThis !== 'undefined' ? globalThis.Sortable : null;
  if (!SortableCtor || typeof SortableCtor.create !== 'function') return;
  var listRoot = document.getElementById('patient-list');
  if (!listRoot || getPatientSearchFilter()) return;
  listRoot.querySelectorAll('.patient-sort-zone').forEach(function (zone) {
    if (zone.classList.contains('patient-sort-zone--virtual-active')) return;
    var sortable = SortableCtor.create(zone, {
      animation: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      draggable: '.patient-card',
      filter: 'button, a[href], input, textarea, select',
      preventOnFilter: true,
      delay: 0,
      delayOnTouchOnly: true,
      direction: 'vertical',
      forceFallback: true,
      fallbackClass: 'patient-drag-hovercard',
      fallbackOnBody: true,
      fallbackTolerance: 4,
      swapThreshold: 0.65,
      invertedSwapThreshold: 0.58,
      scroll: listRoot,
      bubbleScroll: true,
      scrollSensitivity: 54,
      scrollSpeed: 9,
      onEnd: handlePatientSortZoneEnd,
    });
    _patientListSortables.push(sortable);
  });
}

function syncPatientsOrderFromDom() {
  var list = document.getElementById('patient-list');
  if (!list) return;
  var cards = list.querySelectorAll('.patient-card[data-patient-id]');
  if (!cards || !cards.length) return;
  var order = [];
  for (var i = 0; i < cards.length; i++) {
    var pid = cards[i].getAttribute('data-patient-id');
    if (pid) order.push(pid);
  }
  if (!order.length) return;
  var rank = Object.create(null);
  for (var j = 0; j < order.length; j++) rank[order[j]] = j;
  var missingBase = order.length + 1000;
  patients.sort(function (a, b) {
    var ra = Object.prototype.hasOwnProperty.call(rank, a.id) ? rank[a.id] : missingBase;
    var rb = Object.prototype.hasOwnProperty.call(rank, b.id) ? rank[b.id] : missingBase;
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

function mountActiveZoneVirtualIfNeeded(list, active, cardHtml, listCtx) {
  if (!shouldVirtualizeActiveZone(active.length)) {
    destroyPatientActiveZoneVirtual();
    list.removeAttribute('data-patient-list-virtual');
    return;
  }
  var activeZone = list.querySelector('.patient-sort-zone[data-patient-zone="active"]');
  if (!activeZone) return;
  mountPatientActiveZoneVirtual({
    zoneEl: activeZone,
    listEl: list,
    items: active,
    renderCardHtml: cardHtml,
    ctx: listCtx,
  });
}

var _patientListRenderQueued = false;
var _patientListSilentTimer = null;
var PATIENT_LIST_SILENT_DEBOUNCE_MS = 220;

/** @param {{ silent?: boolean }|undefined} [opts] */
function normalizePatientListRenderOpts(opts) {
  return opts && typeof opts === 'object' ? opts : {};
}

/** Solo actualiza .active en tarjetas visibles (evita innerHTML al cambiar paciente). */
export function patchPatientListActiveHighlight(nextId) {
  var list = document.getElementById('patient-list');
  if (!list) return false;
  var cards = list.querySelectorAll('.patient-card[data-patient-id]');
  if (!cards.length) return false;
  if (list.querySelector('.patient-sort-zone--virtual-active[data-patient-zone="active"]')) {
    cards.forEach(function (el) {
      var pid = el.getAttribute('data-patient-id');
      el.classList.toggle('active', String(pid) === String(nextId));
    });
    return true;
  }
  var filtered = patients.filter(patientMatchesSearch);
  if (filtered.length !== cards.length) return false;
  cards.forEach(function (el) {
    var pid = el.getAttribute('data-patient-id');
    el.classList.toggle('active', String(pid) === String(nextId));
  });
  return true;
}

/** @param {{ silent?: boolean }|undefined} [opts] — silent: LAN/incremental (no list flash) */
export function renderPatientList(opts) {
  opts = normalizePatientListRenderOpts(opts);
  if (opts.silent) {
    if (_patientListSilentTimer) clearTimeout(_patientListSilentTimer);
    _patientListSilentTimer = setTimeout(function () {
      _patientListSilentTimer = null;
      renderPatientListNow({ silent: true });
    }, PATIENT_LIST_SILENT_DEBOUNCE_MS);
    return;
  }
  if (_patientListSilentTimer) {
    clearTimeout(_patientListSilentTimer);
    _patientListSilentTimer = null;
  }
  if (_patientListRenderQueued) return;
  _patientListRenderQueued = true;
  requestAnimationFrame(function () {
    _patientListRenderQueued = false;
    renderPatientListNow();
  });
}

function renderPatientListMessage(list, msg, opts) {
  destroyPatientListSortables();
  destroyPatientActiveZoneVirtual();
  var scrollTop = opts.silent ? list.scrollTop : 0;
  list.innerHTML =
    '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">' + msg + '</div>';
  if (opts.silent && scrollTop > 0) list.scrollTop = scrollTop;
  setLastRondaNavIds([]);
  if (rt.getActiveAppTab() === 'agenda') rt.renderProcedureAgendaPanel();
  if (!opts.silent) {
    syncGuardiaCensusPanelVisibility(rt.getSettings());
    renderGuardiaCensusGrid(rt.getSettings());
  }
}

function buildPatientListRenderBundle(filtered, isRonda) {
  var zones = buildPatientListZones(filtered);
  var cardHtml = isRonda ? renderPatientRoundRowHtml : renderPatientCardHtml;
  var archivedCollapsed = isArchivedSectionCollapsed();
  var listCtx = {
    activeId: rt.getActiveId(),
    isRonda: isRonda,
    isRoundSeen: isPatientRoundSeen,
  };
  var onRondaNav = function (z) {
    setLastRondaNavIds(buildRondaNavIds(z));
  };
  return {
    zones: zones,
    cardHtml: cardHtml,
    archivedCollapsed: archivedCollapsed,
    listCtx: listCtx,
    onRondaNav: onRondaNav,
    virtualizeActive: shouldVirtualizeActiveZone(zones.active.length),
  };
}

function trySilentPatientListUpdate(list, bundle, opts) {
  if (!opts.silent) return false;
  var incrementalOpts = {
    zones: bundle.zones,
    archivedCollapsed: bundle.archivedCollapsed,
    patientSearchFilter: getPatientSearchFilter(),
    renderCard: bundle.cardHtml,
    ctx: bundle.listCtx,
    onRondaNav: bundle.onRondaNav,
  };
  var incrementalDomOpts = {
    zones: bundle.zones,
    archivedCollapsed: bundle.archivedCollapsed,
    isRonda: bundle.listCtx.isRonda,
    virtualizeActive: bundle.virtualizeActive,
    renderCard: bundle.cardHtml,
    ctx: bundle.listCtx,
    renderPinnedLabel: function () {
      return renderPinnedSectionLabelHtml(bundle.zones.pinned.length);
    },
    renderActiveLabel: function () {
      return renderActiveSectionLabelHtml(bundle.zones.active.length);
    },
    renderArchivedToggle: function (collapsed, count) {
      return renderArchivedToggleHtml(collapsed, count);
    },
    onRondaNav: bundle.onRondaNav,
  };
  var silentScrollTop = list.scrollTop;
  var silentOk =
    (bundle.virtualizeActive &&
      trySilentVirtualPatientListPatch(list, incrementalOpts)) ||
    (!bundle.virtualizeActive && trySilentPatientListPatch(list, incrementalOpts)) ||
    updatePatientListDomIncremental(list, incrementalDomOpts);
  if (!silentOk) return false;
  if (bundle.virtualizeActive) {
    mountActiveZoneVirtualIfNeeded(list, bundle.zones.active, bundle.cardHtml, bundle.listCtx);
  }
  list.classList.toggle('patient-list--ronda', bundle.listCtx.isRonda);
  if (silentScrollTop > 0) list.scrollTop = silentScrollTop;
  return true;
}


function renderPatientListFullHtml(list, bundle, opts) {
  destroyPatientListSortables();
  list.classList.toggle('patient-list--ronda', bundle.listCtx.isRonda);
  var pinned = bundle.zones.pinned;
  var active = bundle.zones.active;
  var archived = bundle.zones.archived;
  var parts = [];
  var rondaNav = [];
  if (pinned.length) {
    parts.push(renderPinnedSectionLabelHtml(pinned.length));
    parts.push('<div class="patient-sort-zone" data-patient-zone="pinned">');
    pinned.forEach(function (p) {
      rondaNav.push(String(p.id));
    });
    parts.push(pinned.map(bundle.cardHtml).join(''));
    parts.push('</div>');
  }
  if (active.length) {
    parts.push(renderActiveSectionLabelHtml(active.length));
    parts.push(
      '<div class="' +
        (bundle.virtualizeActive
          ? 'patient-sort-zone patient-sort-zone--virtual-active'
          : 'patient-sort-zone') +
        '" data-patient-zone="active">'
    );
    active.forEach(function (p) {
      rondaNav.push(String(p.id));
    });
    if (!bundle.virtualizeActive) parts.push(active.map(bundle.cardHtml).join(''));
    parts.push('</div>');
  }
  if (archived.length) {
    parts.push(
      renderArchivedToggleHtml(bundle.archivedCollapsed, archived.length)
    );
    if (!bundle.archivedCollapsed) {
      parts.push('<div class="patient-sort-zone" data-patient-zone="archived">');
      archived.forEach(function (p) {
        rondaNav.push(String(p.id));
      });
      parts.push(archived.map(bundle.cardHtml).join(''));
      parts.push('</div>');
    }
  }
  setLastRondaNavIds(rondaNav);
  var savedScrollTop = opts.silent ? list.scrollTop : 0;
  list.innerHTML = parts.join('');
  mountActiveZoneVirtualIfNeeded(list, active, bundle.cardHtml, bundle.listCtx);
  if (opts.silent && savedScrollTop > 0) list.scrollTop = savedScrollTop;
  mountPatientListSortables();
  if (rt.getActiveAppTab() === 'agenda') rt.renderProcedureAgendaPanel();
  if (!opts.silent) {
    syncGuardiaCensusPanelVisibility(rt.getSettings());
    renderGuardiaCensusGrid(rt.getSettings());
  }
}

/** @param {{ silent?: boolean }|undefined} [opts] */
function renderPatientListNow(opts) {
  opts = normalizePatientListRenderOpts(opts);
  if (shouldEnforceTeamPatientMirror() && !isClinicalScopeReadyForLanPatientApply()) {
    if (opts.silent) return;
    var listBoot = document.getElementById('patient-list');
    if (listBoot) {
      listBoot.innerHTML =
        '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Sincronizando equipo…</div>';
    }
    return;
  }
  ensurePatientUiState();
  ensurePatientListClickDelegation();
  if (!opts.silent) syncClinicalCensusFiltersBar();
  var list = document.getElementById('patient-list');
  if (!list) return;
  var isRonda = isPaseMode();
  var visiblePatients = patientsVisibleInSidebar();
  reselectIfActivePatientHidden(visiblePatients);
  if (!visiblePatients.length) {
    renderPatientListMessage(list, 'Sin pacientes aún', opts);
    return;
  }
  var filtered = visiblePatients.filter(patientMatchesSearch);
  if (!filtered.length) {
    renderPatientListMessage(list, 'Ningún paciente coincide con la búsqueda', opts);
    return;
  }
  var bundle = buildPatientListRenderBundle(filtered, isRonda);
  if (trySilentPatientListUpdate(list, bundle, opts)) return;
  renderPatientListFullHtml(list, bundle, opts);
}

var _patientListClickWired = false;

/** Clic en tarjeta sin depender solo de onclick inline (módulos ES). */
function ensurePatientListClickDelegation() {
  if (_patientListClickWired) return;
  var root = document.getElementById('patient-list');
  if (!root) return;
  _patientListClickWired = true;
  root.addEventListener('click', function (ev) {
    var card = ev.target && ev.target.closest ? ev.target.closest('.patient-card[data-patient-id]') : null;
    if (!card) return;
    if (ev.target.closest('button, a[href], input, textarea, select')) return;
    var pid = card.getAttribute('data-patient-id');
    if (pid) patientsBridge.selectPatient(pid);
  });
}
