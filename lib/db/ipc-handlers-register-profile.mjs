import {
  getClinicalProfile,
  upsertClinicalProfile,
  touchClinicalUserActivity,
  claimUsername,
  attachClinicalIdentityByUsername,
  migrateTeamMemberships,
  promoteTeamLeader,
  getTeamById,
  findUserTeamForAutoAssign,
  assignPatientToTeam,
  fetchActivePatientTeamId,
  fetchActiveGuardias,
} from './clinical-access-db.mjs';
import { signClinicalChange, verifyIncomingPeerChange } from './clinical-crypto.mjs';
import { bindIpcHandler } from './ipc-handlers-bind.mjs';

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbProfileCrudHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:clinical-profile-get', async (payload) => {
    const profile = await dbManager.withTransaction((db) =>
      getClinicalProfile(db, String(payload.userId || ''))
    );
    return { ok: true, profile };
  });

  bindIpcHandler(ipcMain, 'db:clinical-username-claim', async (payload) => {
    const profile = await dbManager.withTransaction((db) =>
      claimUsername(db, {
        userId: String(payload.userId || ''),
        username: String(payload.username || ''),
      })
    );
    return { ok: true, profile };
  });

  bindIpcHandler(ipcMain, 'db:clinical-profile-upsert', async (payload) => {
    const profile = await dbManager.withTransaction((db) =>
      upsertClinicalProfile(db, {
        userId: String(payload.userId || ''),
        clinicalName: String(payload.clinicalName || ''),
        rank: String(payload.rank || 'R1'),
        sala: String(payload.sala || ''),
        username: payload.username != null ? String(payload.username) : undefined,
        isProgramAdmin: payload.isProgramAdmin,
        adminAccessCode: payload.adminAccessCode,
      })
    );
    return { ok: true, profile };
  });

  bindIpcHandler(ipcMain, 'db:clinical-user-touch', async (payload) => {
    const userId = String(payload.userId || '').trim();
    if (!userId) return { ok: false, error: 'userId requerido' };
    const touched = await dbManager.withTransaction((db) => touchClinicalUserActivity(db, userId));
    return { ok: true, touched: !!touched };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbProfileIdentityHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:clinical-membership-migrate', async (payload) => {
    const moved = await dbManager.withTransaction((db) =>
      migrateTeamMemberships(db, {
        fromUserId: String(payload.fromUserId || ''),
        toUserId: String(payload.toUserId || ''),
      })
    );
    return { ok: true, ...moved };
  });

  bindIpcHandler(ipcMain, 'db:clinical-identity-resume', async (payload) => {
    const result = await dbManager.withTransaction((db, { audit }) => {
      const fromUserId = String(payload.fromUserId || '');
      const user = attachClinicalIdentityByUsername(db, String(payload.username || ''));
      let membershipMoved = 0;
      if (fromUserId && fromUserId !== user.userId) {
        membershipMoved = migrateTeamMemberships(db, {
          fromUserId,
          toUserId: user.userId,
        }).moved;
      }
      const guardias = fetchActiveGuardias(db, user.userId);
      audit(getClientId(), 'clinical.identity.resume', {
        userId: user.userId,
        username: user.username,
        membershipMoved,
      });
      return { user, guardias, membershipMoved };
    });
    return { ok: true, ...result };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbProfileTeamHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:clinical-teams-promote-leader', async (payload) => {
    const team = await dbManager.withTransaction((db) =>
      promoteTeamLeader(db, String(payload.teamId || ''), String(payload.userId || ''))
    );
    return { ok: true, team: team ?? null };
  });

  bindIpcHandler(ipcMain, 'db:clinical-team-get-by-id', async (payload) => {
    const team = await dbManager.withTransaction((db) =>
      getTeamById(db, String(payload.teamId || ''))
    );
    return { ok: true, team: team ?? null };
  });

  bindIpcHandler(ipcMain, 'db:clinical-find-user-team', async (payload) => {
    const row = await dbManager.withTransaction((db) =>
      findUserTeamForAutoAssign(db, String(payload.userId || ''))
    );
    return { ok: true, teamId: row?.team_id ?? null };
  });

  bindIpcHandler(ipcMain, 'db:clinical-assign-patient-to-team', async (payload) => {
    await dbManager.withTransaction((db) =>
      assignPatientToTeam(db, {
        patientId: String(payload.patientId || ''),
        teamId: String(payload.teamId || ''),
        effectiveAt: String(payload.effectiveAt || new Date().toISOString()),
      })
    );
    return { ok: true };
  });

  bindIpcHandler(ipcMain, 'db:patient-active-team-id', async (payload) => {
    const teamId = await dbManager.withTransaction((db) =>
      fetchActivePatientTeamId(
        db,
        String(payload.patientId || ''),
        payload.nowIso ? String(payload.nowIso) : undefined
      )
    );
    return { ok: true, teamId };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbProfileCryptoHandlers(ctx) {
  const { ipcMain } = ctx;

  bindIpcHandler(ipcMain, 'db:sign-clinical-change', async (payload) => {
    const signed = signClinicalChange({
      userId: String(payload.userId || ''),
      privateKeyPem: String(payload.privateKeyPem || ''),
      patientId: String(payload.patientId || ''),
      actionType: String(payload.actionType || 'clinical.mutation'),
      deltaData: payload.deltaData ?? {},
      lastBlockHash: String(payload.lastBlockHash || 'genesis'),
    });
    return { ok: true, signed };
  });

  bindIpcHandler(ipcMain, 'db:verify-clinical-change', async (payload) => {
    const valid = verifyIncomingPeerChange(
      payload.transactionBody || {},
      String(payload.signature || ''),
      String(payload.publicKeyPem || '')
    );
    return { ok: true, valid };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbProfileHandlers(ctx) {
  registerDbProfileCrudHandlers(ctx);
  registerDbProfileIdentityHandlers(ctx);
  registerDbProfileTeamHandlers(ctx);
  registerDbProfileCryptoHandlers(ctx);
}
