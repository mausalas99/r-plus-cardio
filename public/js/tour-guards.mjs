/** Tour-only guards (no settings-help import — avoids cycles with lab-panel). */

let guidedTourActive = false;
let tourStepId = null;

/** Guardia 7.x steps that should show the board/phase bar, not auto-open entrega roster. */
const GUARDIA_V7_BOARD_PANEL_STEPS = new Set([
  'gv7_guardia_tab',
  'gv7_guardia_scope',
  'gv7_guardia_toggle',
  'gv7_entrega_phase',
  'gv7_entrega_patient',
  'gv7_censo_r4',
]);

const GUARDIA_V7_ENTREGA_ROSTER_STEPS = new Set(['gv7_entrega_roster']);

export function syncGuidedTourContext({ active, stepId } = {}) {
  guidedTourActive = !!active;
  tourStepId = stepId || null;
}

export function isGuidedTourRunning() {
  return guidedTourActive;
}

export function getGuidedTourStepId() {
  return tourStepId;
}

export function shouldSuppressGuardiaEntregaBootstrap() {
  if (!guidedTourActive || !tourStepId) return false;
  return GUARDIA_V7_BOARD_PANEL_STEPS.has(tourStepId);
}

export function shouldShowGuardiaBoardWithoutEntrega(stepId) {
  if (!guidedTourActive || !stepId) return false;
  return GUARDIA_V7_BOARD_PANEL_STEPS.has(stepId);
}

export function shouldOpenEntregaRosterForTour(stepId) {
  if (!guidedTourActive || !stepId) return false;
  return GUARDIA_V7_ENTREGA_ROSTER_STEPS.has(stepId);
}
