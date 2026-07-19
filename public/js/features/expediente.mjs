// Expediente — cultivos, listado (sala), pestaña Datos (façade)
import { patientDataAccesosWindowHandlers } from '../patient-data-accesos-ui.mjs';
import { patientTeamAssignWindowHandlers } from '../patient-team-assign-ui.mjs';
import { patientDatosModalWindowHandlers } from '../patient-datos-modal.mjs';
import { patientDataCensoWindowHandlers } from '../patient-data-censo-ui.mjs';
import { registerExpedienteRuntime } from './expediente/expediente-runtime.mjs';
import { buildCultivoAntibiogramCellHtmlForPatient } from './expediente/expediente-cultivos-atb-ui.mjs';
import {
  copyCultivoCondensado,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
} from './expediente/expediente-cultivos-parse.mjs';
import {
  refreshTendenciasOrCultivosPanel,
  renderCultivosTable,
  invalidateCultivosTableCache,
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
} from './expediente/expediente-cultivos-table.mjs';
import { wireAtbRisHoverPanels, removeAtbRisPanelsFromBody } from './expediente/expediente-cultivos-atb-ui.mjs';
import {
  formatPaseCultivoResistenciasHtml,
  paseCultivoAtbBlockHtml,
} from './expediente/expediente-cultivos-pase.mjs';
import {
  renderListadoForm,
  generateListado,
  updateListadoMeta,
  updateProblemaField,
  addProblemaUI,
  removeProblemaUI,
  copyListadoProblemasAiPrompt,
  _autoGrowTextarea,
  updateListadoMedico,
} from './expediente/expediente-listado.mjs';
import {
  buildPatientDemographicsCardHtml,
  renderPatientDataPane,
} from './expediente/expediente-datos.mjs';

export { registerExpedienteRuntime, buildCultivoAntibiogramCellHtmlForPatient, invalidateCultivosTableCache };

export {
  refreshTendenciasOrCultivosPanel,
  renderCultivosTable,
  renderListadoForm,
  removeAtbRisPanelsFromBody,
  wireAtbRisHoverPanels,
  buildCultivoOutputHtmlFragments,
  isResLabChunkPureCultivo,
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
  formatPaseCultivoResistenciasHtml,
  paseCultivoAtbBlockHtml,
  buildPatientDemographicsCardHtml,
  renderPatientDataPane,
  copyCultivoCondensado,
  generateListado,
};

export const windowHandlers = Object.assign(
  {
    copyCultivoCondensado,
    updateListadoMeta,
    updateProblemaField,
    addProblemaUI,
    removeProblemaUI,
    copyListadoProblemasAiPrompt,
    generateListado,
    _autoGrowTextarea,
    renderPatientDataPane,
    updateListadoMedico,
  },
  patientDataCensoWindowHandlers,
  patientDataAccesosWindowHandlers,
  patientTeamAssignWindowHandlers,
  patientDatosModalWindowHandlers
);
