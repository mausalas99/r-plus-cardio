import { closeOverlayAnimated } from './ui-motion.mjs';
import { createTendGroupTableApi } from './tend-group-table.mjs';
import { createTendGroupChartsApi } from './tend-group-charts.mjs';
import { createTendGroupGasoApi } from './tend-group-gaso.mjs';
import {
  prepareTendGroupOpen,
  showTendGroupBackdrop,
  renderTendGroupPanels,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  setTendGroupTab,
} from './tend-group-modal-open.mjs';

export function createTendGroupModal(deps) {
  var state = {
    sectionKey: null,
    patientId: null,
    charts: [],
    tableModel: null,
    activeTab: 'charts',
    tableHiddenBarCollapsed: false,
    historyDesc: [],
    historyAsc: [],
    visibleFields: [],
    specsByField: Object.create(null),
    gasoExtendedFio2: 0.21,
  };

  var tableApi = createTendGroupTableApi(deps, state);
  var chartsApi = createTendGroupChartsApi(deps, state, tableApi);
  var gasoApi = createTendGroupGasoApi(deps, state);
  var renderCharts = chartsApi.renderCharts;
  var renderTable = tableApi.renderTable;
  var destroyCharts = chartsApi.destroyCharts;
  var destroyPanelSortable = chartsApi.destroyPanelSortable;
  var closeGasoExtended = gasoApi.closeGasoExtended;
  var openGasoExtended = gasoApi.openGasoExtended;

  function backdropEl() {
    return document.getElementById('tend-group-backdrop');
  }

  function isOpen() {
    var bd = backdropEl();
    return !!(bd && bd.getAttribute('aria-hidden') === 'false');
  }

  function closeModal() {
    destroyPanelSortable();
    state.sectionKey = null;
    document.body.classList.remove('tend-group-modal-open');
    var bd = backdropEl();
    closeOverlayAnimated(bd, function () {
      if (bd) bd.style.display = 'none';
      destroyCharts();
      var chartsPanel = document.getElementById('tend-group-panel-charts');
      if (chartsPanel) chartsPanel.innerHTML = '';
      var wrap = document.getElementById('tend-group-table-wrap');
      if (wrap) wrap.innerHTML = '';
    });
  }

  function setTab(name) {
    setTendGroupTab(state, name);
  }

  function openModal(sectionKey) {
    if (!prepareTendGroupOpen(deps, state, sectionKey)) return;
    var shown = showTendGroupBackdrop(deps, state, state.activeTab || 'charts');
    if (!shown) return;
    setTab(shown.activeTab);
    renderTendGroupPanels(sectionKey, renderCharts, renderTable);
  }

  return {
    open: openModal,
    close: closeModal,
    isOpen: isOpen,
    setTab: setTab,
    copyTablePng: function () {
      copyTendGroupTablePng(deps, state);
    },
    copyTableText: function () {
      copyTendGroupTableText(deps, state);
    },
    openGasoExtended: openGasoExtended,
    closeGasoExtended: closeGasoExtended,
  };
}
