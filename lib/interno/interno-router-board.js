'use strict';

/**
 * @param {{
 *   getDb: () => import('better-sqlite3').Database | null,
 *   store: { getState: () => { patients: object[] } },
 *   loadEsm: () => Promise<object>,
 * }} ctx
 * @param {string} sala
 */
async function readInternoBoard(ctx, sala) {
  const mod = await ctx.loadEsm();
  const normalized = mod.normalizeInternoSala(sala);
  if (!normalized) return null;

  const db = ctx.getDb?.();
  if (!db) {
    return { sala: normalized, active: false, inactive: true, summary: { total: 0 }, patients: [] };
  }

  const access = db
    .prepare('SELECT is_active FROM sala_interno_access WHERE sala = ?')
    .get(normalized);
  if (!access || access.is_active !== 1) {
    return { sala: normalized, active: false, inactive: true, summary: { total: 0 }, patients: [] };
  }

  const scope = mod.getInternoScopeContext(db);
  const activeGuardias = db
    .prepare(`SELECT * FROM active_guardias WHERE status = 'Active' ORDER BY assigned_at`)
    .all();
  const censusPatientIds = mod.loadCensusPatientIdSet(db);
  const state = ctx.store.getState();
  const patients = mod.resolveInternoBoardPatients(
    state.patients || [],
    activeGuardias,
    normalized,
    scope,
    { censusPatientIds }
  );

  const guardiasByPatientId = new Map();
  for (const g of activeGuardias) {
    guardiasByPatientId.set(String(g.patient_id), g);
  }

  return mod.buildInternoBoardDto(normalized, patients, guardiasByPatientId);
}

module.exports = { readInternoBoard };
