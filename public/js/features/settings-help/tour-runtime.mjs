/** Guided tours facade (BN-05). */
export { GUIDED_TOUR_LS_KEY } from './tour-state.mjs';
export {
  shouldShowGuidedTourIntro,
  normalizeTourVersionLabel,
  syncLearnHubContinueVisibility,
  closeLabBulkTourHintModal,
} from './tour-engine.mjs';
export * from './tour-engine.mjs';
export { DEMO_PATIENT_ID, isTourDemoPatientId } from '../../tour-demo-patient.mjs';
export * from './tour-flow.mjs';
export * from './tour-mini.mjs';

import { tourBridge } from './tour-bridge.mjs';
import { miniTourNext, endMiniTour } from './tour-mini.mjs';
tourBridge.miniTourNext = miniTourNext;
tourBridge.endMiniTour = endMiniTour;

import './tour-demo-seed.mjs';
import './tour-engine.mjs';
import './tour-flow.mjs';
import './tour-mini.mjs';
