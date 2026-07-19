import { renderGroupCharts, destroyGroupCharts } from './tend-group-charts-render.mjs';

export function createTendGroupChartsApi(deps, state, tableApi) {
  var legendLabelForSpec = tableApi.legendLabelForSpec;
  var panelSortableRef = { current: null };

  function renderCharts(sectionKey) {
    renderGroupCharts(deps, state, sectionKey, legendLabelForSpec, panelSortableRef, renderCharts);
  }

  function destroyCharts() {
    destroyGroupCharts(state, panelSortableRef);
  }

  function destroyPanelSortable() {
    if (panelSortableRef.current) {
      try {
        if (typeof panelSortableRef.current.destroy === 'function') panelSortableRef.current.destroy();
      } catch (_e) { void _e; }
      panelSortableRef.current = null;
    }
  }

  return { renderCharts, destroyCharts, destroyPanelSortable };
}
