/**
 * Entrega modal — procedimientos list and add form (façade).
 */
import { defaultHandoffContext } from '../../../lib/entrega/entrega-handoff-context.mjs';
import { defaultVitalsPlan } from '../../../lib/entrega/entrega-vitals-plan.mjs';
import { entregaDraft } from './entrega-modal-ui/entrega-modal-state.mjs';
import { hideAddForm, renderProcList, wireProcUiOnce } from './entrega-modal-ui/entrega-modal-procedures.mjs';
import {
  mountEntregaHandoffPanel,
  readEntregaHandoffContext,
  readEntregaCriticalFromHandoff,
  getEntregaHandoffContext,
} from './entrega-modal-ui/entrega-modal-handoff.mjs';
import {
  mountEntregaVitalsPanel,
  readEntregaVitalsPlan,
} from './entrega-modal-ui/entrega-modal-vitals.mjs';
import { normalizePendientesJson } from '../../../lib/entrega/entrega-pendientes.mjs';

export function resolveEntregaActorRole(currentUser, existingGuardia) {
  const userId = String(currentUser?.user_id || currentUser?.userId || '');
  const coveringUserId = String(existingGuardia?.covering_user_id || '');
  const hasGuardia = !!(existingGuardia?.guardia_id || existingGuardia?.guardiaId);
  const isCoveringReceiver = hasGuardia && coveringUserId !== '' && coveringUserId === userId;
  return {
    role: isCoveringReceiver ? 'guardia' : 'diurno',
    userId,
    rank: String(currentUser?.rank || ''),
  };
}

export function getEntregaDraftItems() {
  return entregaDraft.items.slice();
}

export function resetEntregaModalUi() {
  entregaDraft.items = [];
  entregaDraft.actor = null;
  entregaDraft.sourceTeamId = '';
  entregaDraft.vitalsPlan = defaultVitalsPlan();
  entregaDraft.handoffContext = defaultHandoffContext();
  const statusSlot = document.getElementById('entrega-clinical-status-slot');
  if (statusSlot) statusSlot.innerHTML = '';
  const handoffPanel = document.getElementById('entrega-handoff-panel');
  if (handoffPanel) handoffPanel.innerHTML = '';
  const handoffSummary = document.getElementById('entrega-handoff-summary');
  if (handoffSummary) handoffSummary.textContent = '';
  const list = document.getElementById('entrega-proc-list');
  const formWrap = document.getElementById('entrega-proc-form');
  if (list) list.innerHTML = '';
  if (formWrap) {
    formWrap.innerHTML = '';
    formWrap.classList.add('hidden');
    formWrap.setAttribute('aria-hidden', 'true');
  }
}

export {
  mountEntregaHandoffPanel,
  readEntregaHandoffContext,
  readEntregaCriticalFromHandoff,
  getEntregaHandoffContext,
  mountEntregaVitalsPanel,
  readEntregaVitalsPlan,
};

export async function mountEntregaPendientesUi(opts) {
  wireProcUiOnce();
  entregaDraft.actor = opts.actor;
  entregaDraft.sourceTeamId = String(opts.sourceTeamId || '');
  const doc = normalizePendientesJson(opts.pendientesJson || '');
  entregaDraft.items = doc.items.slice();
  mountEntregaHandoffPanel(doc.handoffContext, {
    isCritical: !!opts.isCritical,
    signedRefusal: !!opts.signedRefusal,
  });
  mountEntregaVitalsPanel({
    vitalsPlan: doc.vitalsPlan,
    vitalsFrequency: opts.vitalsFrequency,
  });
  hideAddForm();
  renderProcList();
}
