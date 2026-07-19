import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidUsernameFormat,
  isLegacyMachineUsername,
  isLanDirectoryPendingUsername,
  isLanRegisteredClinicalUser,
  normalizeUsername,
} from './clinical-username.mjs';

describe('clinical-username', () => {
  it('accepts valid handles', () => {
    assert.equal(isValidUsernameFormat('mgarcia'), true);
    assert.equal(isValidUsernameFormat('r2_garcia'), true);
  });

  it('rejects invalid handles', () => {
    assert.equal(isValidUsernameFormat('MG'), false);
    assert.equal(isValidUsernameFormat('ab'), false);
    assert.equal(isValidUsernameFormat(''), false);
  });

  it('detects legacy clientId usernames', () => {
    assert.equal(isLegacyMachineUsername('lc_abc123_xyz', 'lc_abc123_xyz'), true);
    assert.equal(isLegacyMachineUsername('mgarcia', 'lc_abc'), false);
  });

  it('normalizes to lowercase trim', () => {
    assert.equal(normalizeUsername('  MGarcia '), 'mgarcia');
  });

  it('strips leading @ before validation', () => {
    assert.equal(normalizeUsername('@draleslie'), 'draleslie');
    assert.equal(isValidUsernameFormat('@draleslie'), true);
  });

  it('marks machine and peer stub handles as directory-pending', () => {
    assert.equal(isLanDirectoryPendingUsername('lc_pending_device'), true);
    assert.equal(isLanDirectoryPendingUsername('peer_abc123'), true);
    assert.equal(isLanDirectoryPendingUsername('mgarcia'), false);
    assert.equal(isLanDirectoryPendingUsername('admin_dir'), false);
  });

  it('isLanRegisteredClinicalUser — @usuario or nombre clínico, sin exigir sala', () => {
    assert.equal(isLanRegisteredClinicalUser({ username: 'mgarcia', clinical_name: '' }), true);
    assert.equal(
      isLanRegisteredClinicalUser({
        username: 'lc_pending_device',
        clinical_name: 'Dra. Sin Sala',
      }),
      true
    );
    assert.equal(
      isLanRegisteredClinicalUser({ username: 'lc_pending_device', clinical_name: '' }),
      false
    );
    assert.equal(isLanRegisteredClinicalUser({ username: 'dev-a', clinical_name: '' }), false);
  });
});
