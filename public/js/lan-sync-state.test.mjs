import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  RoomSyncPhase,
  getRoomSyncPhase,
  setRoomSyncPhase,
  clearRoomSyncPhase,
  subscribeRoomSyncPhase,
} from './lan-sync-state.mjs';

const ROOM = 'sala-1';

describe('lan-sync-state', () => {
  beforeEach(() => {
    clearRoomSyncPhase(ROOM);
    clearRoomSyncPhase('sala-2');
  });

  it('starts offline without room', () => {
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.offline);
    assert.equal(getRoomSyncPhase(), RoomSyncPhase.offline);
  });

  it('joining -> catching_up -> live', () => {
    setRoomSyncPhase(ROOM, RoomSyncPhase.joining);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.joining);
    setRoomSyncPhase(ROOM, RoomSyncPhase.catching_up);
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.live);
  });

  it('live -> degraded on disconnect', () => {
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    setRoomSyncPhase(ROOM, RoomSyncPhase.degraded);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.degraded);
  });

  it('clearRoomSyncPhase returns room to offline', () => {
    setRoomSyncPhase(ROOM, RoomSyncPhase.joining);
    clearRoomSyncPhase(ROOM);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.offline);
  });

  it('leave flow: configured then clear', () => {
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    setRoomSyncPhase(ROOM, RoomSyncPhase.configured);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.configured);
    clearRoomSyncPhase(ROOM);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.offline);
  });

  it('subscribeRoomSyncPhase notifies on transitions', () => {
    const events = [];
    const unsub = subscribeRoomSyncPhase(function (d) {
      events.push(d);
    });
    setRoomSyncPhase(ROOM, RoomSyncPhase.joining);
    setRoomSyncPhase(ROOM, RoomSyncPhase.catching_up);
    unsub();
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    assert.equal(events.length, 2);
    assert.equal(events[0].roomId, ROOM);
    assert.equal(events[0].phase, RoomSyncPhase.joining);
    assert.equal(events[1].phase, RoomSyncPhase.catching_up);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.live);
  });

  it('setRoomSyncPhase is idempotent for listeners', () => {
    const events = [];
    const unsub = subscribeRoomSyncPhase(function (d) {
      events.push(d);
    });
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    setRoomSyncPhase(ROOM, RoomSyncPhase.catching_up);
    setRoomSyncPhase(ROOM, RoomSyncPhase.catching_up);
    unsub();
    assert.equal(events.length, 2);
    assert.equal(events[0].phase, RoomSyncPhase.live);
    assert.equal(events[1].phase, RoomSyncPhase.catching_up);
  });

  it('tracks phases independently per room', () => {
    setRoomSyncPhase('sala-2', RoomSyncPhase.joining);
    setRoomSyncPhase(ROOM, RoomSyncPhase.live);
    assert.equal(getRoomSyncPhase('sala-2'), RoomSyncPhase.joining);
    assert.equal(getRoomSyncPhase(ROOM), RoomSyncPhase.live);
  });
});
