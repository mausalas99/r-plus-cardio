'use strict';

const { assertInternoPatientOnBoard } = require('./interno-router-handlers-shared.js');

/** @param {object|null|undefined} stored @param {string} patientId */
function resolveInternoVitalsPatient(stored, patientId) {
  if (stored) return { cur: stored, isNewPatient: false };
  return {
    cur: {
      id: patientId,
      monitoreo: { historial: [], estadoClinico: {}, confirmado: {} },
    },
    isNewPatient: true,
  };
}

/** @param {object} nextPatient */
function ensureInternoMonitoreoShell(nextPatient) {
  if (!nextPatient.monitoreo) {
    nextPatient.monitoreo = { historial: [], estadoClinico: {}, confirmado: {} };
  }
}

/**
 * @param {{
 *   getDb: () => import('better-sqlite3').Database | null,
 *   store: {
 *     getState: () => { patients: object[] },
 *     upsertPatient: (p: object, v?: number) => object,
 *   },
 *   broadcastSync?: (name: string, obj: object) => void,
 *   onHostSync?: (obj: object) => void,
 *   loadEsm: () => Promise<object>,
 *   readBoard: (sala: string) => Promise<object|null>,
 *   broadcastInterno: (sala: string, obj: object) => void,
 * }} ctx
 */
function createInternoVitalsPostHandler(ctx) {
  async function applyInternoVitalsToStore(patientId, body, sala) {
    const mod = await ctx.loadEsm();
    const built = mod.buildInternoMedicion({
      vitals: body?.vitals,
      glucometrias: body?.glucometrias,
      reporterName: body?.reporterName,
      sala,
    });
    if (!built.ok) return { ok: false, status: 400, error: 'empty_medicion' };

    const state = ctx.store.getState();
    const stored = (state.patients || []).find((p) => String(p.id) === patientId);
    const { cur, isNewPatient } = resolveInternoVitalsPatient(stored, patientId);

    const nextPatient = structuredClone(cur);
    ensureInternoMonitoreoShell(nextPatient);
    const applied = mod.applyInternoMedicionToPatient(nextPatient, built.medicion);
    if (!applied.ok) return { ok: false, status: 400, error: 'apply_failed' };

    const updated = isNewPatient
      ? ctx.store.upsertPatient(nextPatient)
      : ctx.store.upsertPatient(nextPatient, Number(cur.version || 0));

    const db = ctx.getDb?.();
    if (db) mod.touchActiveGuardiaVitalsCheck(db, patientId);

    return {
      ok: true,
      patientId,
      version: updated.version,
      hasAlterations: built.hasAlterations,
      nextPatient,
    };
  }

  function emitInternoVitalsSync(sala, patientId, nextPatient, hasAlterations) {
    const syncPayload = {
      type: 'patients-updated',
      patientId,
      monitoreo: nextPatient.monitoreo || null,
    };
    if (typeof ctx.broadcastSync === 'function') {
      ctx.broadcastSync('sync', syncPayload);
      ctx.broadcastSync('sync', { type: 'guardias-updated', patientId });
    }
    if (typeof ctx.onHostSync === 'function') {
      ctx.onHostSync(syncPayload);
      ctx.onHostSync({ type: 'guardias-updated', patientId });
    }
    ctx.broadcastInterno(sala, {
      type: 'board-changed',
      patientId,
      hasAlterations,
    });
  }

  return async function handleInternoVitalsPost(req, res) {
    try {
      const patientId = String(req.body?.patientId || '').trim();
      if (!patientId) return res.status(400).json({ error: 'patient_id_required' });

      const board = await assertInternoPatientOnBoard(ctx, res, req.internoSala, patientId);
      if (!board) return;

      const applied = await applyInternoVitalsToStore(patientId, req.body, req.internoSala);
      if (!applied.ok) return res.status(applied.status).json({ error: applied.error });

      emitInternoVitalsSync(
        req.internoSala,
        applied.patientId,
        applied.nextPatient,
        applied.hasAlterations
      );

      res.json({
        ok: true,
        patientId: applied.patientId,
        version: applied.version,
        hasAlterations: applied.hasAlterations,
      });
    } catch (e) {
      if (e.code === 'CONFLICT') {
        return res.status(409).json({ error: 'conflict' });
      }
      res.status(500).json({ error: e.message || 'vitals_failed' });
    }
  };
}

module.exports = { createInternoVitalsPostHandler };
