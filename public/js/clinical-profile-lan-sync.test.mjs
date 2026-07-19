import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBenignLanPushSkipCode,
  isLanProfileNeedsConnectCode,
  resolveRoomIdForUsernameRegister,
} from './clinical-profile-lan-sync.mjs';

describe('clinical-profile-lan-sync room resolve', () => {
  it('maps clinical Sala to LiveSync room id', () => {
    assert.equal(resolveRoomIdForUsernameRegister({ sala: 'Sala 1' }), 'sala-1');
    assert.equal(resolveRoomIdForUsernameRegister({ sala: 'Sala E' }), 'sala-e');
    assert.equal(resolveRoomIdForUsernameRegister({ sala: 'Torre HU' }), 'torre-hu');
    assert.equal(resolveRoomIdForUsernameRegister({ sala: 'Área A/Pensionistas' }), 'area-a-pensionistas');
  });

  it('treats offline / no-room push as benign', () => {
    assert.equal(isBenignLanPushSkipCode('NO_ROOM'), true);
    assert.equal(isBenignLanPushSkipCode('NO_LAN'), true);
    assert.equal(isBenignLanPushSkipCode('HTTP_FAIL'), false);
  });

  it('detects connect-needed push codes', () => {
    assert.equal(isLanProfileNeedsConnectCode('NO_LAN'), true);
    assert.equal(isLanProfileNeedsConnectCode('NO_ROOM'), true);
    assert.equal(isLanProfileNeedsConnectCode('NO_SNAPSHOT'), false);
  });

  it('prefers explicit roomId over sala', () => {
    assert.equal(
      resolveRoomIdForUsernameRegister({ roomId: 'sala-2', sala: 'Sala 1' }),
      'sala-2'
    );
  });

});
