import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EquiposError } from './equipos-errors.mjs';
import {
  canJoinEquiposWaitlist,
  resolveCheckoutQueueGate,
  waitlistIndexFor,
  waitlistRowsForBypassNotify,
} from './equipos-queue-custody.mjs';

describe('equipos-queue-custody', () => {
  const waitlist = [
    { reporter_name: 'Team 2', rotation: 'Sala 2' },
    { reporter_name: 'Team 3', rotation: 'Torre HU' },
    { reporter_name: 'Team 4', rotation: 'Sala E' },
  ];

  it('waitlistIndexFor finds position', () => {
    assert.equal(waitlistIndexFor(waitlist, 'Team 3', 'Torre HU'), 1);
    assert.equal(waitlistIndexFor(waitlist, 'Nobody', 'Sala 1'), -1);
  });

  it('resolveCheckoutQueueGate allows head without bypass', () => {
    const gate = resolveCheckoutQueueGate(waitlist, 'Team 2', 'Sala 2', false);
    assert.equal(gate.bypassed, false);
  });

  it('resolveCheckoutQueueGate blocks non-head without bypass', () => {
    assert.throws(
      () => resolveCheckoutQueueGate(waitlist, 'Team 4', 'Sala E', false),
      (e) => e instanceof EquiposError && e.code === 'not_next_in_queue'
    );
    assert.throws(
      () => resolveCheckoutQueueGate(waitlist, 'Team 5', 'Sala 1', false),
      (e) => e instanceof EquiposError && e.code === 'not_in_queue'
    );
  });

  it('resolveCheckoutQueueGate allows bypass for out-of-turn take', () => {
    const gate = resolveCheckoutQueueGate(waitlist, 'Team 4', 'Sala E', true);
    assert.equal(gate.bypassed, true);
    assert.equal(gate.notifyWaitlist.length, 3);
  });

  it('waitlistRowsForBypassNotify excludes taker', () => {
    const rows = waitlistRowsForBypassNotify(waitlist, 'Team 4', 'Sala E');
    assert.deepEqual(
      rows.map((r) => r.reporter_name),
      ['Team 2', 'Team 3']
    );
  });

  it('canJoinEquiposWaitlist when in use or available', () => {
    assert.equal(canJoinEquiposWaitlist('in_use'), true);
    assert.equal(canJoinEquiposWaitlist('available'), true);
    assert.equal(canJoinEquiposWaitlist('alert'), false);
  });
});
