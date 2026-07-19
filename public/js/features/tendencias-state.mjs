import { rt } from './tendencias-runtime-state.mjs';

import { esc } from '../dom-escape.mjs';
function aid() {
  return rt.getActiveId();
}

function trendSparkDomId(sectionKey, fieldKey) {
  return (
    'spark-' +
    String(sectionKey).replace(/[^a-zA-Z0-9]+/g, '_') +
    '-' +
    String(fieldKey).replace(/[^a-zA-Z0-9]+/g, '_')
  );
}

function trendSparkChartKey(sectionKey, fieldKey) {
  return sectionKey + '\x01' + fieldKey;
}

/** Shared mutable renderer state (import properties, do not reassign bindings). */
export const tendStore = {
  _tendCardSortables: [],
  sparkCharts: {},
  detailChart: null,
  _tendRenderState: {
    key: null,
    seriesKeys: [],
    seriesIndex: null,
    seriesAvail: null,
  },
};

export { aid, esc, trendSparkDomId, trendSparkChartKey };
