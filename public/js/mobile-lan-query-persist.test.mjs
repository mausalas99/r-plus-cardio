import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMobilePairingFromSearch,
  mergeMobileLanConfig,
  persistMobilePairingFromSearch,
  restoreMobilePairingFromStorage,
  resolveStoredMobileRoomId,
  MOBILE_MODE_KEY,
} from './mobile-lan-query-persist.mjs';

describe('mobile-lan-query-persist', () => {
  it('buildMobilePairingFromSearch lee token, room y sharer', () => {
    const cfg = buildMobilePairingFromSearch(
      '?token=ward-abc&room=sala-2&user=jperez&name=Juan&rank=R2&sala=Sala%202&rpc-mobile=1',
      'http://192.168.0.5:3738'
    );
    assert.equal(cfg?.teamCode, 'ward-abc');
    assert.equal(cfg?.hostUrl, 'http://192.168.0.5:3738');
    assert.equal(cfg?.roomId, 'sala-2');
    assert.equal(cfg?.sharer?.user, 'jperez');
  });

  it('mergeMobileLanConfig conserva roomId si el URL solo trae token', () => {
    const merged = mergeMobileLanConfig(
      { hostUrl: 'http://10.0.0.1:3738', teamCode: 'new-token' },
      { hostUrl: 'http://10.0.0.1:3738', teamCode: 'old', roomId: 'sala-1' }
    );
    assert.equal(merged.teamCode, 'new-token');
    assert.equal(merged.roomId, 'sala-1');
  });

  it('persist + restore escriben membresía de sala', () => {
    const store = new Map();
    globalThis.localStorage = {
      setItem(k, v) {
        store.set(k, v);
      },
      getItem(k) {
        return store.get(k) ?? null;
      },
      removeItem(k) {
        store.delete(k);
      },
    };
    assert.equal(
      persistMobilePairingFromSearch(
        '?token=t1&room=sala-1',
        'http://192.168.1.2:3738'
      ),
      true
    );
    assert.equal(store.get(MOBILE_MODE_KEY), '1');
    store.delete('rpc-lan-room-membership');
    assert.equal(restoreMobilePairingFromStorage(), true);
    const mem = JSON.parse(store.get('rpc-lan-room-membership'));
    assert.equal(mem.roomId, 'sala-1');
    assert.equal(resolveStoredMobileRoomId(), 'sala-1');
  });
});
