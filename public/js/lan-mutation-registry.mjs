/**
 * LAN Mutation Registry — routes domain saves to typed endpoints or
 * the untyped 30-second safety bundle.
 *
 * Usage:
 *   import { lanMutationRegistry } from './lan-mutation-registry.mjs';
 *   lanMutationRegistry.registerMutationHandler('nota', pushNotaToHost);
 *   lanMutationRegistry.dispatchLanMutation('nota', patientId, payload);
 *
 * For testing, use createMutationRegistry(deps) to get an isolated instance.
 */

export function createMutationRegistry(deps = {}) {
  const handlers = new Map();
  const domainKinds = new Map();

  let isActiveRef = deps.isActive ?? (() => false);
  let markUntypedDirtyRef = deps.markUntypedDirty ?? (() => {});
  let scheduleUntypedSafety = deps.scheduleUntypedSafetyBundle ?? (() => {});
  let enqueueOutboxRef = deps.enqueueOutbox ?? (() => {});
  let getActiveRoomIdRef = deps.getActiveRoomId ?? (() => '');

  function configure(liveDeps) {
    if (typeof liveDeps.isActive === 'function') isActiveRef = liveDeps.isActive;
    if (typeof liveDeps.markUntypedDirty === 'function') markUntypedDirtyRef = liveDeps.markUntypedDirty;
    if (typeof liveDeps.scheduleUntypedSafetyBundle === 'function') {
      scheduleUntypedSafety = liveDeps.scheduleUntypedSafetyBundle;
    }
    if (typeof liveDeps.enqueueOutbox === 'function') enqueueOutboxRef = liveDeps.enqueueOutbox;
    if (typeof liveDeps.getActiveRoomId === 'function') getActiveRoomIdRef = liveDeps.getActiveRoomId;
  }

  function registerMutationHandler(domain, handler) {
    handlers.set(String(domain), handler);
  }

  function setDomainOutboxKind(domain, kind) {
    domainKinds.set(String(domain), kind);
  }

  function isTypedDomain(domain) {
    return handlers.has(String(domain));
  }

  async function dispatchLanMutation(domain, patientId, payload) {
    if (!isActiveRef()) return;
    const handler = handlers.get(String(domain));
    if (handler) {
      try {
        await handler(patientId, payload);
      } catch {
        const kind = domainKinds.get(String(domain));
        if (kind) {
          const roomId = getActiveRoomIdRef();
          if (roomId) enqueueOutboxRef(roomId, { kind, payload: { patientId, data: payload } });
        }
      }
    } else {
      markUntypedDirtyRef(domain, patientId);
      scheduleUntypedSafety();
    }
  }

  return {
    registerMutationHandler,
    setDomainOutboxKind,
    isTypedDomain,
    dispatchLanMutation,
    configure,
  };
}

// Singleton for production use; wired in orchestrator.mjs at boot.
export const lanMutationRegistry = createMutationRegistry();
