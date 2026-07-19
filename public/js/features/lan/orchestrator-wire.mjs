/** LAN bridge registration and client event wiring (IM-11). */
import { getLanRuntime } from './orchestrator-runtime.mjs';
import {
  configureLanSyncDomainModules,
  registerLanSyncBridgeHandlers,
} from './orchestrator-wire-config.mjs';
import {
  wireLanMutationRegistryHandlers,
  wireLanClientEventListeners,
} from './orchestrator-wire-events.mjs';

var lanSyncBridgesWired = false;

/** Idempotent LAN bridge registration (safe when esbuild loads room/push before this module). */
export function wireLanSyncBridges() {
  if (lanSyncBridgesWired) return;
  lanSyncBridgesWired = true;
  var runtime = getLanRuntime();
  configureLanSyncDomainModules(runtime);
  registerLanSyncBridgeHandlers(runtime);
  wireLanMutationRegistryHandlers();
  wireLanClientEventListeners();
}
