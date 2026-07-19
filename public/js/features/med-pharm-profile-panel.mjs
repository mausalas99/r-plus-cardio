/**
 * UI Perfil farmacoterapéutico (subvista Medicamentos). Barrel — lógica en submódulos.
 */
export { registerMedPharmProfileRuntime, getMedSubview, closeMedPharmMoreMenu } from './med-pharm-profile-state.mjs';
export { setMedSubview } from './med-pharm-profile-subview.mjs';
export { initMedPharmSubviewUi, renderMedPharmProfilePanel, onRecetaMergedToProfile } from './med-pharm-profile-render.mjs';
export { stashMedPharmPasteForPatient } from './med-pharm-profile-stash.mjs';
export {
  closeMedPharmModals,
  openMedPharmPasteModal,
  deleteMedPharmViewMonth,
  deleteMedPharmProfileAll,
  openMedPharmMedGroupModal,
  openMedPharmFullModal,
  importMedPharmMonthPaste,
} from './med-pharm-profile-modals.mjs';

import { setMedSubview } from './med-pharm-profile-subview.mjs';
import {
  importMedPharmMonthPaste,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  closeMedPharmModals,
  deleteMedPharmViewMonth,
  deleteMedPharmProfileAll,
} from './med-pharm-profile-modals.mjs';
import { closeMedPharmMoreMenu } from './med-pharm-profile-state.mjs';

export const medPharmProfileWindowHandlers = {
  setMedSubview,
  importMedPharmMonthPaste,
  openMedPharmPasteModal,
  openMedPharmFullModal,
  closeMedPharmModals,
  closeMedPharmMoreMenu,
  deleteMedPharmViewMonth,
  deleteMedPharmProfileAll,
};
