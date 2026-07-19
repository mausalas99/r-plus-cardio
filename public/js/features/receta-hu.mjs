/**
 * Pestaña Receta médica HU (000-061-R-06-12) — Interconsulta.
 */
export { registerRecetaHuRuntime, flushRecetaHuDraftIfMountedFor } from './receta-hu-shared.mjs';
export { renderRecetaHu } from './receta-hu-render.mjs';
export { exportRecetaHuPdf } from './receta-hu-export.mjs';
import {
  recetaHuCommitMedFromCompose,
  recetaHuRemoveMedRow,
  recetaHuCommitLabFromCompose,
  recetaHuRemoveLabRow,
  recetaHuOnConsultServicePick,
  recetaHuCommitProximaFromCompose,
  recetaHuRemoveProximaRow,
  recetaHuAddConsultService,
} from './receta-hu-actions.mjs';
import { exportRecetaHuPdf } from './receta-hu-export.mjs';

export const recetaHuWindowHandlers = {
  recetaHuCommitMedFromCompose,
  recetaHuRemoveMedRow,
  recetaHuCommitLabFromCompose,
  recetaHuRemoveLabRow,
  recetaHuCommitProximaFromCompose,
  recetaHuRemoveProximaRow,
  recetaHuOnConsultServicePick,
  recetaHuAddConsultService,
  exportRecetaHuPdf,
};
