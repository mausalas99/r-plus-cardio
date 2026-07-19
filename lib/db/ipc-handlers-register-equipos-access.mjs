import { getClinicalProfile } from './clinical-access-db.mjs';
import { canManageInternoQr } from './clinical-privileges.mjs';
import {
  getEquiposProgramAccess,
  rotateEquiposProgramToken,
  setEquiposProgramActive,
} from '../equipos/equipos-db.mjs';
import { bindIpcHandler } from './ipc-handlers-bind.mjs';

function assertEquiposAdmin(db, userId) {
  const profile = getClinicalProfile(db, String(userId || ''));
  if (!canManageInternoQr(profile)) {
    throw new Error('Sin permisos para gestionar equipos.');
  }
  return profile;
}

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbEquiposAccessHandlers(ctx) {
  const { ipcMain, dbManager, getClientId } = ctx;

  bindIpcHandler(ipcMain, 'db:equipos-access-get', async () => {
    const row = await dbManager.withTransaction((db) => getEquiposProgramAccess(db));
    return { ok: true, row };
  });

  bindIpcHandler(ipcMain, 'db:equipos-access-rotate', async (payload) => {
    const row = await dbManager.withTransaction((db, { audit }) => {
      const userId = String(payload.userId || '');
      assertEquiposAdmin(db, userId);
      const out = rotateEquiposProgramToken(db, userId);
      audit(getClientId(), 'equipos.token.rotate', { userId });
      return out;
    });
    return { ok: true, row };
  });

  bindIpcHandler(ipcMain, 'db:equipos-access-set-active', async (payload) => {
    const row = await dbManager.withTransaction((db, { audit }) => {
      const userId = String(payload.userId || '');
      assertEquiposAdmin(db, userId);
      const out = setEquiposProgramActive(db, !!payload.active);
      audit(getClientId(), 'equipos.access.toggle', { active: !!payload.active, userId });
      return out;
    });
    return { ok: true, row };
  });
}

export { assertEquiposAdmin };
