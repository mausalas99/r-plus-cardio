import {
  resolveBootstrapClinicalUser,
  fetchActiveGuardias,
  fetchOrphanActiveGuardias,
  resolveActiveGuardia,
  upsertActiveGuardia,
  upsertRotationCycle,
  getActiveRotationCycle,
  archiveRotationAndTeams,
  fetchIncomingAssignments,
  getClinicalScopeContext,
} from './clinical-access-db.mjs';
import { stampRotationNuevaAt } from './clinical-ops-sync.mjs';
import { bindIpcHandler } from './ipc-handlers-bind.mjs';

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbGuardiaReadHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:clinical-access-bootstrap', async (payload) => {
    const result = await dbManager.withTransaction((db, { audit }) => {
      const user = resolveBootstrapClinicalUser(db, {
        clientId: String(payload.clientId || getClientId()),
        rank: String(payload.rank || 'R1'),
        preferredUserId: payload.preferredUserId ? String(payload.preferredUserId) : undefined,
        preferredUsername: payload.preferredUsername
          ? String(payload.preferredUsername)
          : undefined,
      });
      const guardias = fetchActiveGuardias(db, user.userId);
      const orphans = fetchOrphanActiveGuardias(db, user.userId);
      audit(getClientId(), 'clinical.access.bootstrap', {
        userId: user.userId,
        guardiaCount: guardias.length,
      });
      return { user, guardias, orphans };
    });
    return { ok: true, ...result };
  });

  bindIpcHandler(ipcMain, 'db:clinical-scope-context', async (payload) => {
    const context = await dbManager.withTransaction((db) =>
      getClinicalScopeContext(db, payload.userId ? String(payload.userId) : undefined)
    );
    return { ok: true, context };
  });

  bindIpcHandler(ipcMain, 'db:guardia-census', async (payload) => {
    const result = await dbManager.withTransaction((db) => {
      const userId = payload.userId ? String(payload.userId) : null;
      const guardias = fetchActiveGuardias(db, userId || undefined);
      const orphans = fetchOrphanActiveGuardias(db, userId || undefined);
      return { guardias, orphans };
    });
    return { ok: true, ...result };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbGuardiaMutationHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:guardia-resolve', async (payload) => {
    const row = await dbManager.withTransaction((db, { audit }) => {
      const res = resolveActiveGuardia(db, {
        patientId: payload.patientId ? String(payload.patientId) : undefined,
        guardiaId: payload.guardiaId ? String(payload.guardiaId) : undefined,
      });
      if (res.resolved) {
        audit(getClientId(), 'entrega.resolve', {
          patientId: res.patient_id,
          guardiaId: res.guardia_id,
        });
      }
      return res;
    });
    return { ok: true, ...row };
  });

  bindIpcHandler(ipcMain, 'db:guardia-upsert', async (payload) => {
    const guardia = await dbManager.withTransaction((db, { audit }) => {
      const row = upsertActiveGuardia(db, {
        patientId: String(payload.patientId || ''),
        coveringUserId: String(payload.coveringUserId || ''),
        sourceTeamId: String(payload.sourceTeamId || ''),
        guardiaId: payload.guardiaId ? String(payload.guardiaId) : undefined,
        isCritical: payload.isCritical,
        pendientesJson: payload.pendientesJson,
        vitalsFrequency: payload.vitalsFrequency,
        lastVitalsCheck: payload.lastVitalsCheck ? String(payload.lastVitalsCheck) : undefined,
      });
      audit(getClientId(), 'entrega.assign', {
        patientId: row.patient_id,
        guardiaId: row.guardia_id,
        coveringUserId: row.covering_user_id,
      });
      return row;
    });
    return { ok: true, guardia };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbGuardiaRotationHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:rotation-cycle-get', async () => {
    const cycle = await dbManager.withTransaction((db) => getActiveRotationCycle(db));
    return { ok: true, cycle: cycle ?? null };
  });

  bindIpcHandler(ipcMain, 'db:rotation-cycle-upsert', async (payload) => {
    const cycle = await dbManager.withTransaction((db) =>
      upsertRotationCycle(db, {
        monthEndAt: String(payload.monthEndAt || ''),
        effectiveAt: String(payload.effectiveAt || ''),
        previewDays: payload.previewDays ?? 2,
        createdBy: payload.createdBy ? String(payload.createdBy) : undefined,
      })
    );
    return { ok: true, cycle };
  });

  bindIpcHandler(ipcMain, 'db:rotation-nueva', async (payload) => {
    await dbManager.withTransaction((db, { audit }) => {
      const now = new Date().toISOString();
      archiveRotationAndTeams(db);
      stampRotationNuevaAt(db, now);
      if (payload.userId) {
        audit(getClientId(), 'rotation.nueva', { userId: String(payload.userId) });
      }
    });
    return { ok: true };
  });

  bindIpcHandler(ipcMain, 'db:rotation-incoming-assignments', async () => {
    const assignments = await dbManager.withTransaction((db) =>
      fetchIncomingAssignments(db, new Date().toISOString())
    );
    return { ok: true, assignments };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbGuardiaHandlers(ctx) {
  registerDbGuardiaReadHandlers(ctx);
  registerDbGuardiaMutationHandlers(ctx);
  registerDbGuardiaRotationHandlers(ctx);
}
