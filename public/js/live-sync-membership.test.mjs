import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getRoomMembership,
  setRoomMembership,
  clearRoomMembership,
  migrateLastRoomToMembership,
} from './live-sync-membership.mjs';

const LAST_KEY = 'rpc-lan-last-room';

function mockLocalStorage(initial) {
  global.localStorage = {
    _d: { ...initial },
    getItem(k) {
      return this._d[k] ?? null;
    },
    setItem(k, v) {
      this._d[k] = v;
    },
    removeItem(k) {
      delete this._d[k];
    },
  };
}

test('set/get/clear membership', () => {
  mockLocalStorage({});
  setRoomMembership({ roomId: 'r1', label: 'Turno A' });
  const m = getRoomMembership();
  assert.equal(m.roomId, 'r1');
  assert.equal(m.label, 'Turno A');
  assert.ok(m.joinedAt);
  clearRoomMembership();
  assert.equal(getRoomMembership(), null);
});

test('migrateLastRoomToMembership copies rpc-lan-last-room once', () => {
  mockLocalStorage({ [LAST_KEY]: 'old-room' });
  migrateLastRoomToMembership();
  assert.equal(getRoomMembership().roomId, 'old-room');
  assert.equal(getRoomMembership().label, 'old-room');
});

test('migrateLastRoomToMembership is no-op when membership exists', () => {
  mockLocalStorage({ [LAST_KEY]: 'other' });
  setRoomMembership({ roomId: 'kept', label: 'Kept' });
  migrateLastRoomToMembership();
  assert.equal(getRoomMembership().roomId, 'kept');
});
