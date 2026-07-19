import {
  getClinicalProfile,
  listSalaInternoAccess,
  rotateSalaInternoToken,
  setSalaInternoActive,
  listEntregaTemplates,
  saveEntregaTemplateUser,
  saveEntregaTemplateTeam,
  deleteEntregaTemplate,
} from './clinical-access-db.mjs';
import { canManageInternoQr } from './clinical-privileges.mjs';
import {
  countLanSyncOutbox,
  drainLanSyncOutbox,
  enqueueLanSyncOutbox,
} from './lan-sync-outbox.mjs';
import { bindIpcHandler } from './ipc-handlers-bind.mjs';

function assertInternoQrAccess(db, userId) {
  const profile = getClinicalProfile(db, String(userId || ''));
  if (!canManageInternoQr(profile)) {
    throw new Error('Sin permisos para gestionar QR de internos.');
  }
  return profile;
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbInternoAccessHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:interno-access-list', async (payload) => {
    const rows = await dbManager.withTransaction((db) => {
      assertInternoQrAccess(db, payload.userId);
      return listSalaInternoAccess(db);
    });
    return { ok: true, rows };
  });

  bindIpcHandler(ipcMain, 'db:interno-access-rotate', async (payload) => {
    const row = await dbManager.withTransaction((db, { audit }) => {
      const userId = String(payload.userId || '');
      assertInternoQrAccess(db, userId);
      const out = rotateSalaInternoToken(db, String(payload.sala || ''), userId);
      audit(getClientId(), 'interno.token.rotate', { sala: out?.sala, userId });
      return out;
    });
    return { ok: true, row };
  });

  bindIpcHandler(ipcMain, 'db:interno-access-set-active', async (payload) => {
    const row = await dbManager.withTransaction((db, { audit }) => {
      const userId = String(payload.userId || '');
      assertInternoQrAccess(db, userId);
      const out = setSalaInternoActive(db, String(payload.sala || ''), !!payload.active);
      audit(getClientId(), 'interno.access.toggle', {
        sala: out?.sala,
        active: !!payload.active,
        userId,
      });
      return out;
    });
    return { ok: true, row };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbEntregaTemplateHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:entrega-template-list', async (payload) => {
    const templates = await dbManager.withTransaction((db) =>
      listEntregaTemplates(db, {
        userId: String(payload.userId || ''),
        teamIds: Array.isArray(payload.teamIds) ? payload.teamIds.map(String) : [],
      })
    );
    return { ok: true, ...templates };
  });

  bindIpcHandler(ipcMain, 'db:entrega-template-save-user', async (payload) => {
    const template = await dbManager.withTransaction((db) =>
      saveEntregaTemplateUser(db, {
        userId: String(payload.userId || ''),
        templateId: payload.templateId ? String(payload.templateId) : undefined,
        name: String(payload.name || ''),
        payload: payload.payload,
      })
    );
    return { ok: true, template };
  });

  bindIpcHandler(ipcMain, 'db:entrega-template-save-team', async (payload) => {
    const template = await dbManager.withTransaction((db) =>
      saveEntregaTemplateTeam(db, {
        teamId: String(payload.teamId || ''),
        createdBy: payload.createdBy ? String(payload.createdBy) : undefined,
        templateId: payload.templateId ? String(payload.templateId) : undefined,
        name: String(payload.name || ''),
        payload: payload.payload,
      })
    );
    return { ok: true, template };
  });

  bindIpcHandler(ipcMain, 'db:entrega-template-delete', async (payload) => {
    const deleted = await dbManager.withTransaction((db) =>
      deleteEntregaTemplate(db, {
        scope: payload.scope === 'team' ? 'team' : 'user',
        templateId: String(payload.templateId || ''),
      })
    );
    return { ok: true, deleted };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
function registerDbLanOutboxHandlers(ctx) {
  const { ipcMain, dbManager } = ctx;

  bindIpcHandler(ipcMain, 'db:lan-outbox-enqueue', async (payload) => {
    const out = await dbManager.withTransaction((db) =>
      enqueueLanSyncOutbox(db, {
        roomId: String(payload.roomId || ''),
        kind: payload.kind,
        payload: payload.payload,
      })
    );
    return { ok: true, id: out.id };
  });

  bindIpcHandler(ipcMain, 'db:lan-outbox-drain', async (payload) => {
    const items = await dbManager.withTransaction((db) =>
      drainLanSyncOutbox(db, { roomId: String(payload.roomId || '') })
    );
    return { ok: true, items };
  });

  bindIpcHandler(ipcMain, 'db:lan-outbox-count', async (payload) => {
    const count = await dbManager.withTransaction((db) =>
      countLanSyncOutbox(db, { roomId: String(payload.roomId || '') })
    );
    return { ok: true, count };
  });
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbInternoHandlers(ctx) {
  registerDbInternoAccessHandlers(ctx);
  registerDbEntregaTemplateHandlers(ctx);
  registerDbLanOutboxHandlers(ctx);
}
