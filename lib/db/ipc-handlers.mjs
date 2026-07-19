import { buildBackupEnvelope, computeMigrationPending, probeMigrationNeeded } from './ipc-handlers-shared.mjs';
import { registerDbCoreHandlers } from './ipc-handlers-register-core.mjs';
import { registerDbGuardiaHandlers } from './ipc-handlers-register-guardia.mjs';
import { registerDbTeamsHandlers } from './ipc-handlers-register-teams.mjs';
import { registerDbProfileHandlers } from './ipc-handlers-register-profile.mjs';
import { registerDbInternoHandlers } from './ipc-handlers-register-interno.mjs';
import { registerDbEquiposHandlers } from './ipc-handlers-register-equipos.mjs';

/**
 * @param {{
 *   ipcMain: import('electron').IpcMain,
 *   dbManager: ReturnType<import('./db-manager.mjs').createDbManager>,
 *   app: import('electron').App,
 *   dialog: import('electron').Dialog,
 *   safeStorage: import('electron').SafeStorage,
 *   getClientId: () => string,
 * }} opts
 */
export function registerDbIpcHandlers({ ipcMain, dbManager, app, dialog, safeStorage: _safeStorage, getClientId }) {
  const ctx = {
    ipcMain,
    dbManager,
    app,
    dialog,
    getClientId,
    userDataPath: () => app.getPath('userData'),
  };
  registerDbCoreHandlers(ctx);
  registerDbGuardiaHandlers(ctx);
  registerDbTeamsHandlers(ctx);
  registerDbProfileHandlers(ctx);
  registerDbInternoHandlers(ctx);
  registerDbEquiposHandlers(ctx);
}

/** @deprecated internal — exported for tests */
export const __test = {
  migrationPending: computeMigrationPending,
  buildBackupEnvelope,
  probeMigrationNeeded,
};
