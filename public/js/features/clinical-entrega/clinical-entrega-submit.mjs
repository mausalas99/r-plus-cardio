// Persist entrega assignment + form payload
import {
  clinicalSessionContext,
  refreshGuardiaCensusFromDb,
  signOutgoingLiveSyncMutation,
} from '../../clinical-access-runtime.mjs';
import { dbApi, toast } from './clinical-entrega-util.mjs';
import { buildEntregaSubmitPayload } from './clinical-entrega-submit-helpers.mjs';

async function syncEntregaLanAfterSave_(patientId) {
  try {
    const lan = await import('./lan-sync.mjs');
    if (typeof lan.pushClinicalOpsLanNow === 'function') {
      await lan.pushClinicalOpsLanNow();
    }
    const push = await import('./lan/push.mjs');
    if (typeof push.markUntypedDirty === 'function') {
      push.markUntypedDirty('entrega', patientId);
    }
    if (typeof push.scheduleUntypedSafetyBundle === 'function') {
      push.scheduleUntypedSafetyBundle();
    }
  } catch {
    /* LAN optional — local entrega still saved */
  }
}

export async function submitEntregaAssignment(payload) {
  const api = dbApi();
  if (!api || typeof api.dbGuardiaUpsert !== 'function') {
    throw new Error('Base clínica no disponible');
  }

  const patientId = String(payload.patientId || '');
  const deltaData = {
    coveringUserId: payload.coveringUserId,
    sourceTeamId: payload.sourceTeamId,
    isCritical: !!payload.isCritical,
    pendientesJson: payload.pendientesJson || '[]',
    vitalsFrequency: payload.vitalsFrequency || 'None',
  };

  await signOutgoingLiveSyncMutation(
    { patientId, entityId: patientId, data: deltaData, op: 'entrega.assign' },
    'entrega.assign'
  );

  const res = await api.dbGuardiaUpsert({
    patientId,
    coveringUserId: payload.coveringUserId,
    sourceTeamId: payload.sourceTeamId,
    guardiaId: payload.guardiaId,
    isCritical: payload.isCritical ? 1 : 0,
    pendientesJson: payload.pendientesJson || '[]',
    vitalsFrequency: payload.vitalsFrequency || 'None',
  });

  if (!res || res.ok === false) {
    throw new Error(res?.error || 'No se guardó la entrega');
  }

  await syncEntregaLanAfterSave_(patientId);

  return res.guardia;
}

/**
 * @param {HTMLFormElement|null|undefined} form
 * @returns {{ ok: true, payload: object } | { ok: false, error: string }}
 */
export function collectEntregaFormPayload(form) {
  if (!form) return { ok: false, error: 'Formulario de entrega no disponible' };
  const patientId = String(form.dataset.patientId || '');
  if (!patientId) return { ok: false, error: 'Paciente no seleccionado' };

  const guardiaId = form.dataset.guardiaId ? String(form.dataset.guardiaId) : undefined;
  const existingGuardia = guardiaId
    ? clinicalSessionContext.guardias.find((g) => String(g.guardia_id) === guardiaId)
    : clinicalSessionContext.guardiasMap.get(patientId);
  const payload = buildEntregaSubmitPayload(patientId, guardiaId, existingGuardia);

  if (!payload.coveringUserId || !payload.sourceTeamId) {
    return { ok: false, error: 'Selecciona R1 de guardia y equipo del paciente.' };
  }

  return { ok: true, payload };
}

/**
 * @param {HTMLFormElement|null|undefined} form
 * @param {{ silent?: boolean }} [opts]
 */
export async function persistEntregaFormState(form, opts = {}) {
  const collected = collectEntregaFormPayload(form);
  if (!collected.ok) return collected;

  try {
    const guardia = await submitEntregaAssignment(collected.payload);
    if (guardia?.guardia_id && form) {
      form.dataset.guardiaId = String(guardia.guardia_id);
    }
    await refreshGuardiaCensusFromDb(null);
    import('../../lan-mutation-registry.mjs').then(function (m) {
      m.lanMutationRegistry.dispatchLanMutation('entrega', collected.payload.patientId);
    });
    if (!opts.silent) toast('Entrega registrada.', 'success');
    return { ok: true, guardia };
  } catch (err) {
    const error = err?.message || 'Error al registrar entrega';
    if (!opts.silent) toast(error, 'error');
    return { ok: false, error };
  }
}
