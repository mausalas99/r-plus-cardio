// Tendencias — barrel: runtime registration + re-exports
import { rt } from './tendencias-runtime-state.mjs';
import { tendenciasBridge } from './tendencias-bridge.mjs';
import * as tc from './tendencias-core.mjs';
import { renderTendencias } from './tendencias-render.mjs';

import { mountTendCardSortables, syncTendHiddenModalIfOpen } from './tendencias-ui-shell.mjs';

tendenciasBridge.renderTendencias = renderTendencias;
tendenciasBridge.mountTendCardSortables = mountTendCardSortables;
tendenciasBridge.syncTendHiddenModalIfOpen = syncTendHiddenModalIfOpen;

export function registerTendenciasRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
  tc.initTendGroupModal();
  tc.ensureTendHiddenModalDelegation();
  tc.ensureTendenciasClickDelegation();
}


export { renderTendencias } from './tendencias-render.mjs';
export {
  getLabOutputPrefs,
  setLabOutputPrefs,
  isGasoInterpretacionResLabChunk,
  isCitoquimInterpretacionResLabChunk,
  isAscitisInterpretacionResLabChunk,
  citoquimInterpretacionBody_,
  ascitisInterpretacionBody_,
  isBhMainResLabChunk,
  formatBhExtendedTabLine,
  openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged,
} from './tendencias-lab-prefs.mjs';
export {
  inferFechaLabSetFromId,
  formatDMYDate,
  seedTendHiddenDefaults,
  isTendGroupModalOpen,
  closeTendDetail,
  openTendGroupModal,
  openTendGasoExtendedModal,
  closeTendGroupModal,
  setTendGroupTab,
  copyTendGroupTablePng,
  copyTendGroupTableText,
  toggleTendSection,
  toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard,
  tendUnhideSeries,
  tendResetAllHiddenSeries,
  openTendHiddenModal,
  closeTendHiddenModal,
  openTendDetail,
  tendCardActivate,
} from './tendencias-core.mjs';

export const tendenciasWindowHandlers = {
  closeTendDetail: tc.closeTendDetail,
  openTendGroupModal: tc.openTendGroupModal,
  openTendGasoExtendedModal: tc.openTendGasoExtendedModal,
  closeTendGroupModal: tc.closeTendGroupModal,
  setTendGroupTab: tc.setTendGroupTab,
  copyTendGroupTablePng: tc.copyTendGroupTablePng,
  copyTendGroupTableText: tc.copyTendGroupTableText,
  toggleTendSection: tc.toggleTendSection,
  toggleTendAbnormalOnlyFilter: tc.toggleTendAbnormalOnlyFilter,
  tendHideSeriesFromCard: tc.tendHideSeriesFromCard,
  tendUnhideSeries: tc.tendUnhideSeries,
  tendResetAllHiddenSeries: tc.tendResetAllHiddenSeries,
  openTendHiddenModal: tc.openTendHiddenModal,
  closeTendHiddenModal: tc.closeTendHiddenModal,
  openTendDetail: tc.openTendDetail,
  tendCardActivate: tc.tendCardActivate,
  openLabDisplayPrefsModal: tc.openLabDisplayPrefsModal,
  closeLabDisplayPrefsModal: tc.closeLabDisplayPrefsModal,
  onLabDisplayPrefsChanged: tc.onLabDisplayPrefsChanged,
};
