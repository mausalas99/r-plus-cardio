import { registerDbEquiposAccessHandlers } from './ipc-handlers-register-equipos-access.mjs';
import { registerDbEquiposBoardHandlers } from './ipc-handlers-register-equipos-board.mjs';

/** @param {import('./ipc-handlers-context.mjs').IpcHandlerContext} ctx */
export function registerDbEquiposHandlers(ctx) {
  registerDbEquiposAccessHandlers(ctx);
  registerDbEquiposBoardHandlers(ctx);
}
