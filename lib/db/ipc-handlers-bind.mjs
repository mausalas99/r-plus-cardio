import { ipcError } from './ipc-handlers-shared.mjs';

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {string} channel
 * @param {(payload: Record<string, unknown>) => Promise<Record<string, unknown>>} handler
 */
export function bindIpcHandler(ipcMain, channel, handler) {
  ipcMain.handle(channel, async (_e, payload = {}) => {
    try {
      return await handler(payload);
    } catch (err) {
      return ipcError(err);
    }
  });
}

/**
 * @param {import('./ipc-handlers-context.mjs').IpcHandlerContext['dbManager']} dbManager
 * @param {(payload: Record<string, unknown>) => (db: import('better-sqlite3').Database, ctx: object) => unknown} buildWork
 */
export function bindDbTxnHandler(ipcMain, channel, dbManager, buildWork) {
  bindIpcHandler(ipcMain, channel, async (payload) => {
    const result = await dbManager.withTransaction(buildWork(payload));
    if (result && typeof result === 'object' && result.ok === false) return result;
    if (result === undefined) return { ok: true };
    if (typeof result === 'object' && !('ok' in result)) return { ok: true, ...result };
    return { ok: true, result };
  });
}
