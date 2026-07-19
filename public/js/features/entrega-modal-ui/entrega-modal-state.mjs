// Shared entrega modal draft state
import { defaultHandoffContext } from '../../../../lib/entrega/entrega-handoff-context.mjs';
import { defaultVitalsPlan } from '../../../../lib/entrega/entrega-vitals-plan.mjs';

export const entregaDraft = {
  items: [],
  actor: null,
  sourceTeamId: '',
  vitalsPlan: defaultVitalsPlan(),
  handoffContext: defaultHandoffContext(),
};

export const entregaUiFlags = {
  procWired: false,
  handoffWired: false,
};
