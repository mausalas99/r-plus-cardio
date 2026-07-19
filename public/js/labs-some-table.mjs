/**
 * Parser y exportación de tablas SOME por tipo de estudio (departamento + subgrupo).
 * Complementa procesarLabs: conserva filas tabulares del reporte original.
 */
export { SOME_DEPARTMENTS, formatSomeResultado } from './labs-some-table-helpers.mjs';
export { parseSomeReportTables } from './labs-some-table-parse.mjs';
export {
  buildSomeGroupExportModel,
  buildSomeGroupTsv,
  buildSomeDeptTsv,
  buildSomeDeptExportModel,
} from './labs-some-table-export.mjs';
export {
  renderSomeTableGroupHtml,
  renderSomeReportTablesHtml,
} from './labs-some-table-render.mjs';
export {
  exportSomeGroupCopy,
  exportSomeDeptCopy,
  wireSomeTableExportButtons,
} from './labs-some-table-wire.mjs';
