import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We test the registry using pure unit stubs — no real LAN session needed.
// The registry must be reset between tests by reimporting or via a reset fn.

describe('dispatchLanMutation', () => {
  it('calls the registered handler for a typed domain', async () => {
    const { createMutationRegistry } = await import('./lan-mutation-registry.mjs');
    const registry = createMutationRegistry({ isActive: () => true });

    let called = null;
    registry.registerMutationHandler('nota', async (pid, payload) => {
      called = { pid, payload };
    });

    await registry.dispatchLanMutation('nota', 'p1', { texto: 'hello' });
    assert.deepEqual(called, { pid: 'p1', payload: { texto: 'hello' } });
  });

  it('returns immediately when no active LAN session', async () => {
    const { createMutationRegistry } = await import('./lan-mutation-registry.mjs');
    const registry = createMutationRegistry({ isActive: () => false });

    let called = false;
    registry.registerMutationHandler('nota', async () => { called = true; });
    await registry.dispatchLanMutation('nota', 'p1', {});

    assert.equal(called, false);
  });

  it('calls markUntypedDirty and scheduleUntypedSafetyBundle for unknown domain', async () => {
    const { createMutationRegistry } = await import('./lan-mutation-registry.mjs');
    let dirtyArgs = null;
    let scheduleCalled = false;

    const registry = createMutationRegistry({
      isActive: () => true,
      markUntypedDirty: (domain, pid) => { dirtyArgs = { domain, pid }; },
      scheduleUntypedSafetyBundle: () => { scheduleCalled = true; },
    });

    await registry.dispatchLanMutation('vpo', 'p1');
    assert.deepEqual(dirtyArgs, { domain: 'vpo', pid: 'p1' });
    assert.equal(scheduleCalled, true);
  });

  it('enqueues outbox when typed handler throws', async () => {
    const { createMutationRegistry } = await import('./lan-mutation-registry.mjs');
    let enqueued = null;

    const registry = createMutationRegistry({
      isActive: () => true,
      enqueueOutbox: (roomId, item) => { enqueued = { roomId, item }; },
      getActiveRoomId: () => 'room1',
    });

    registry.registerMutationHandler('nota', async () => { throw new Error('network'); });
    registry.setDomainOutboxKind('nota', 'nota_replace');

    await registry.dispatchLanMutation('nota', 'p1', { texto: 'hi' });
    assert.equal(enqueued?.item?.kind, 'nota_replace');
    assert.equal(enqueued?.roomId, 'room1');
  });

  it('isTypedDomain returns true for registered domains', async () => {
    const { createMutationRegistry } = await import('./lan-mutation-registry.mjs');
    const registry = createMutationRegistry({ isActive: () => true });
    registry.registerMutationHandler('nota', async () => {});
    assert.equal(registry.isTypedDomain('nota'), true);
    assert.equal(registry.isTypedDomain('vpo'), false);
    assert.equal(registry.isTypedDomain('patient-fields'), false);
  });

  it('patient-fields uses untyped fallback when no handler registered', async () => {
    const { createMutationRegistry } = await import('./lan-mutation-registry.mjs');
    let dirtyArgs = null;
    let scheduleCalled = false;
    const registry = createMutationRegistry({
      isActive: () => true,
      markUntypedDirty: (domain, pid) => {
        dirtyArgs = { domain, pid };
      },
      scheduleUntypedSafetyBundle: () => {
        scheduleCalled = true;
      },
    });
    await registry.dispatchLanMutation('patient-fields', 'p-del');
    assert.deepEqual(dirtyArgs, { domain: 'patient-fields', pid: 'p-del' });
    assert.equal(scheduleCalled, true);
    assert.equal(registry.isTypedDomain('patient-fields'), false);
  });
});
