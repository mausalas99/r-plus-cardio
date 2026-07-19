import {
  renderGroupTable,
  createTableExportModel,
  formatCellValue,
  tableColumnHeader,
  tableLegendLabelForSpec,
} from './tend-group-table-render.mjs';

export function createTendGroupTableApi(deps, state) {
  function renderTable(sectionKey) {
    renderGroupTable(deps, state, sectionKey, renderTable);
  }

  function buildTableExportModel(sectionKey, rawModel, hidden) {
    return createTableExportModel(deps, state, sectionKey, rawModel, hidden);
  }

  function columnHeader(set, columns) {
    return tableColumnHeader(set, columns);
  }

  function legendLabelForSpec(sectionKey, spec) {
    return tableLegendLabelForSpec(deps, sectionKey, spec);
  }

  return { renderTable, buildTableExportModel, formatCellValue, columnHeader, legendLabelForSpec };
}
