import {
  buildEquiposBoard,
  listEquiposSessions,
  listEquiposTeamReportsAll,
  equiposAdminPurgeQueue,
  promoteEquiposTemporaryHost,
  exportEquiposMergeSnapshot,
  clearEquiposTemporaryHost,
  mergeEquiposStateFromSnapshot,
} from '../equipos/equipos-db.mjs';
import { bindIpcHandler } from './ipc-handlers-bind.mjs';
import { assertEquiposAdmin } from './ipc-handlers-register-equipos-access.mjs';

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbEquiposBoardHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:equipos-board', async () => {
    const board = await dbManager.withTransaction((db) => buildEquiposBoard(db));
    return { ok: true, board };
  });

  bindIpcHandler(ipcMain, 'db:equipos-reports', async (payload) => {
    const data = await dbManager.withTransaction((db) => {
      if (payload?.userId) assertEquiposAdmin(db, payload.userId);
      return {
        sessions: listEquiposSessions(db, 100),
        reports: listEquiposTeamReportsAll(db, 100),
      };
    });
    return { ok: true, ...data };
  });

  bindIpcHandler(ipcMain, 'db:equipos-purge-queue', async (payload) => {
    const results = await dbManager.withTransaction((db, { audit }) => {
      const profile = assertEquiposAdmin(db, payload.userId);
      const out = equiposAdminPurgeQueue(db, {
        deviceType: payload.deviceType || 'all',
        adminUserId: payload.userId,
        adminName: profile?.clinical_name || profile?.username || 'Admin',
      });
      audit(getClientId(), 'equipos.purge_queue', {
        deviceType: payload.deviceType || 'all',
        userId: payload.userId,
      });
      return out;
    });
    return { ok: true, results };
  });

  bindIpcHandler(ipcMain, 'db:equipos-promote-temporary-host', async (payload) => {
    const lease = await dbManager.withTransaction((db) =>
      promoteEquiposTemporaryHost(db, {
        hostUrl: String(payload.hostUrl || ''),
        holderUserId: String(payload.userId || ''),
        holderRank: String(payload.rank || ''),
        holderName: String(payload.name || ''),
        rememberedPrimaryUrl: String(payload.rememberedPrimaryUrl || ''),
      })
    );
    return { ok: true, lease };
  });

  bindIpcHandler(ipcMain, 'db:equipos-merge-snapshot', async (payload) => {
    const out = await dbManager.withTransaction((db) => {
      const merged = mergeEquiposStateFromSnapshot(db, payload.snapshot);
      clearEquiposTemporaryHost(db);
      return merged;
    });
    return { ok: true, ...out };
  });

  bindIpcHandler(ipcMain, 'db:equipos-export-merge-snapshot', async () => {
    const snapshot = await dbManager.withTransaction((db) => exportEquiposMergeSnapshot(db));
    return { ok: true, snapshot };
  });
}
