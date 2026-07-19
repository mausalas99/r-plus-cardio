import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper: import a fresh module instance for each test by appending a query param.
// This works for node:test because each dynamic import with a unique specifier
// gets its own module graph.
async function freshProfile() {
  const { createNetworkProfile } = await import('./lan-network-profile.mjs');
  return createNetworkProfile();
}

describe('createNetworkProfile', () => {
  it('starts in fast state', async () => {
    const p = await freshProfile();
    assert.equal(p.getNetworkProfile(), 'fast');
  });

  it('transitions FAST → SLOW after 3 consecutive slow pings', async () => {
    const p = await freshProfile();
    p.recordPingSuccess(600); // RTT > 500ms
    p.recordPingSuccess(600);
    assert.equal(p.getNetworkProfile(), 'fast', 'still fast after 2 slow readings');
    p.recordPingSuccess(600);
    assert.equal(p.getNetworkProfile(), 'slow', 'slow after 3 consecutive slow readings');
  });

  it('transitions SLOW → FAST after 5 consecutive fast pings', async () => {
    const p = await freshProfile();
    // Get to SLOW first
    p.recordPingSuccess(600);
    p.recordPingSuccess(600);
    p.recordPingSuccess(600);
    assert.equal(p.getNetworkProfile(), 'slow');
    // Now recover
    p.recordPingSuccess(100);
    p.recordPingSuccess(100);
    p.recordPingSuccess(100);
    p.recordPingSuccess(100);
    assert.equal(p.getNetworkProfile(), 'slow', 'still slow after 4 fast readings');
    p.recordPingSuccess(100);
    assert.equal(p.getNetworkProfile(), 'fast', 'fast after 5 consecutive fast readings');
  });

  it('transitions FAST → OFFLINE after 5 consecutive ping failures', async () => {
    const p = await freshProfile();
    for (let i = 0; i < 4; i++) p.recordPingFailure();
    assert.equal(p.getNetworkProfile(), 'fast', 'still fast after 4 failures');
    p.recordPingFailure();
    assert.equal(p.getNetworkProfile(), 'offline');
  });

  it('transitions SLOW → OFFLINE after 3 consecutive ping failures', async () => {
    const p = await freshProfile();
    p.recordPingSuccess(600); p.recordPingSuccess(600); p.recordPingSuccess(600);
    assert.equal(p.getNetworkProfile(), 'slow');
    p.recordPingFailure(); p.recordPingFailure();
    assert.equal(p.getNetworkProfile(), 'slow', 'still slow after 2 failures');
    p.recordPingFailure();
    assert.equal(p.getNetworkProfile(), 'offline');
  });

  it('a single slow ping does not reset SLOW→FAST counter', async () => {
    const p = await freshProfile();
    p.recordPingSuccess(600); p.recordPingSuccess(600); p.recordPingSuccess(600);
    p.recordPingSuccess(100); p.recordPingSuccess(100); p.recordPingSuccess(100); p.recordPingSuccess(100);
    p.recordPingSuccess(600); // one slow ping resets counter
    p.recordPingSuccess(100); p.recordPingSuccess(100); p.recordPingSuccess(100); p.recordPingSuccess(100); p.recordPingSuccess(100);
    // After the reset + 5 fast, should be fast now
    assert.equal(p.getNetworkProfile(), 'fast');
  });

  it('userInitiatedReconnect resolves to fast when ping succeeds with low RTT', async () => {
    const p = await freshProfile();
    // Force offline
    for (let i = 0; i < 5; i++) p.recordPingFailure();
    assert.equal(p.getNetworkProfile(), 'offline');
    // Simulate reconnect: inject a successful ping result
    const promise = p.userInitiatedReconnect();
    p._simulatePingResult(true, 80);
    const result = await promise;
    assert.ok(['fast', 'slow'].includes(result), 'must resolve to fast or slow');
    assert.equal(p.getNetworkProfile(), result);
  });

  it('userInitiatedReconnect stays offline when ping fails', async () => {
    const p = await freshProfile();
    for (let i = 0; i < 5; i++) p.recordPingFailure();
    const promise = p.userInitiatedReconnect();
    p._simulatePingResult(false, 0);
    const result = await promise;
    assert.equal(result, 'offline');
    assert.equal(p.getNetworkProfile(), 'offline');
  });

  it('subscribeNetworkProfile calls callback on transition', async () => {
    const p = await freshProfile();
    const transitions = [];
    const unsub = p.subscribeNetworkProfile((profile) => transitions.push(profile));
    p.recordPingSuccess(600); p.recordPingSuccess(600); p.recordPingSuccess(600);
    assert.deepEqual(transitions, ['slow']);
    for (let i = 0; i < 3; i++) p.recordPingFailure();
    assert.deepEqual(transitions, ['slow', 'offline']);
    unsub();
    for (let i = 0; i < 5; i++) p.recordPingSuccess(100); // would be fast, but unsub
    assert.deepEqual(transitions, ['slow', 'offline'], 'no callback after unsubscribe');
  });

  it('resetProfile returns to fast', async () => {
    const p = await freshProfile();
    for (let i = 0; i < 5; i++) p.recordPingFailure();
    assert.equal(p.getNetworkProfile(), 'offline');
    p.resetProfile();
    assert.equal(p.getNetworkProfile(), 'fast');
  });

  it('getLastRttMs returns the most recent ping RTT', async () => {
    const p = await freshProfile();
    assert.equal(p.getLastRttMs(), 0);
    p.recordPingSuccess(123);
    assert.equal(p.getLastRttMs(), 123);
    p.recordPingSuccess(200);
    assert.equal(p.getLastRttMs(), 200);
  });
});
