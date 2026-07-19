import { deleteHostPatientCensus } from './lan-patient-delete.mjs';
import { buildPatientDeleteMutation } from './lan-patient-delete.mjs';
import { wrapLiveSyncPatch } from '../../versioned-mutation.mjs';

/** @param {string} step @param {object} ctx */
export async function runLanPatientDeleteStep(step, ctx) {
  if (step === 'census_delete') {
    const census = await deleteHostPatientCensus(ctx.pid, ctx.reg);
    if (census.ok) return { ok: true, via: ctx.hostRow ? 'delete_census' : 'delete_bundle' };
    return {
      ok: false,
      lastFail: {
        ok: false,
        error: census.status ? 'host_reject_' + census.status : 'purge_failed',
        status: census.status,
      },
    };
  }
  if (step === 'versioned_delete') {
    const mutation = ctx.mutation || buildPatientDeleteMutation(ctx.pid, ctx.hostRow, ctx.reg, ctx.rid);
    const httpResult = await ctx.pushVersioned(ctx.pid, mutation);
    if (httpResult?.ok) return { ok: true, result: httpResult };
    return {
      ok: false,
      lastFail: {
        ok: false,
        error: httpResult?.status ? 'host_reject_' + httpResult.status : 'purge_failed',
        status: httpResult?.status,
      },
      mutation,
    };
  }
  if (step === 'outbox_delete') {
    const mutation = ctx.mutation || buildPatientDeleteMutation(ctx.pid, ctx.hostRow, ctx.reg, ctx.rid);
    await ctx.enqueueOutbox(ctx.rid, {
      kind: 'patch',
      payload: wrapLiveSyncPatch(ctx.rid, ctx.getClientId(), mutation),
    });
    await ctx.flushOutbox(ctx.rid);
    return { ok: false, done: true, lastFail: ctx.lastFail, mutation };
  }
  return { ok: false };
}
