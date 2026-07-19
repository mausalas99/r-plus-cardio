/**
 * LAN host patient delete transport — explicit step list (bundle-only vs census row).
 * Policy (ownership, tombstone, live-sync) stays in orchestrator.mjs.
 */
import { lanFetchAuthed } from './transport.mjs';
import { createMutationBuilder } from '../../versioned-mutation.mjs';
import { resolveLanPatientDeleteSteps } from './lan-patient-delete-policy.mjs';
import { runLanPatientDeleteStep } from './lan-patient-delete-steps.mjs';

export { resolveLanPatientDeleteSteps } from './lan-patient-delete-policy.mjs';

/**
 * @param {string} patientId
 * @param {object | null | undefined} hostRow
 * @param {string} registroFallback
 * @param {string} roomId
 */
export function buildPatientDeleteMutation(patientId, hostRow, registroFallback, roomId) {
  var pid = String(patientId || '').trim();
  var base =
    hostRow && typeof hostRow === 'object'
      ? Object.assign({}, hostRow, {
          id: pid,
          version: Number(hostRow.version || 1),
        })
      : {
          id: pid,
          registro: String(registroFallback || '').trim(),
          version: 0,
        };
  return createMutationBuilder('patient', pid).captureBase(base).build({
    roomId: roomId,
    op: 'delete',
  });
}

/**
 * @param {string} patientId
 * @param {string} [registro]
 */
export async function deleteHostPatientCensus(patientId, registro) {
  var pid = String(patientId || '').trim();
  if (!pid) return { ok: false, error: 'invalid_id' };
  var reg = String(registro || '').trim();
  var qs = reg ? '?registro=' + encodeURIComponent(reg) : '';
  var resp = await lanFetchAuthed('/api/lan/v1/patients/' + encodeURIComponent(pid) + qs, {
    method: 'DELETE',
  });
  if (resp.ok || resp.status === 404) return { ok: true, status: resp.status };
  return { ok: false, status: resp.status };
}

/**
 * @param {string} patientId
 * @param {object | null | undefined} hostRow
 * @param {string} registroFallback
 * @param {{
 *   roomId: string,
 *   getClientId: () => string,
 *   pushVersioned: (pid: string, mutation: object) => Promise<{ ok?: boolean, status?: number }>,
 *   enqueueOutbox: (rid: string, item: object) => Promise<void>,
 *   flushOutbox: (rid: string) => Promise<void>,
 *   hostOnly?: boolean,
 * }} ctx
 */
export async function pushPatientDeleteToHost(patientId, hostRow, registroFallback, ctx) {
  var pid = String(patientId || '').trim();
  var reg = String(registroFallback || (hostRow && hostRow.registro) || '').trim();
  var rid = String(ctx.roomId || '').trim();
  if (!rid) return { ok: false, error: 'not_configured' };

  var steps = resolveLanPatientDeleteSteps(!!hostRow, { hostOnly: !!ctx.hostOnly });
  var stepCtx = {
    pid: pid,
    reg: reg,
    rid: rid,
    hostRow: hostRow,
    pushVersioned: ctx.pushVersioned,
    enqueueOutbox: ctx.enqueueOutbox,
    flushOutbox: ctx.flushOutbox,
    getClientId: ctx.getClientId,
    lastFail: { ok: false, error: 'purge_failed' },
    mutation: null,
  };

  for (var i = 0; i < steps.length; i += 1) {
    var result = await runLanPatientDeleteStep(steps[i], stepCtx);
    if (result.ok) {
      if (result.via) return { ok: true, via: result.via };
      return result.result || { ok: true };
    }
    if (result.lastFail) stepCtx.lastFail = result.lastFail;
    if (result.mutation) stepCtx.mutation = result.mutation;
    if (result.done) return stepCtx.lastFail;
  }

  return stepCtx.lastFail;
}
