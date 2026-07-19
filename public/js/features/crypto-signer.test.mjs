import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signClinicalChange, verifyIncomingPeerChange } from '../../../lib/db/clinical-crypto.mjs';

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('clinical-crypto', () => {
  it('signClinicalChange returns verifiable signature and block hash', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const result = signClinicalChange({
      userId: 'user-1',
      privateKeyPem: privateKey,
      patientId: 'pat-1',
      actionType: 'UPDATE_VITALS',
      deltaData: { hr: 88 },
      lastBlockHash: 'genesis',
    });

    assert.ok(result.transactionBody.timestamp);
    assert.equal(result.transactionBody.userId, 'user-1');
    assert.match(result.signature, /^[0-9a-f]+$/);
    assert.equal(
      verifyIncomingPeerChange(result.transactionBody, result.signature, publicKey),
      true
    );
  });

  it('verifyIncomingPeerChange rejects tampered payload', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const result = signClinicalChange({
      userId: 'user-1',
      privateKeyPem: privateKey,
      patientId: 'pat-1',
      actionType: 'NOTE',
      deltaData: { text: 'stable' },
      lastBlockHash: 'abc',
    });

    const tampered = { ...result.transactionBody, patientId: 'pat-2' };
    assert.equal(verifyIncomingPeerChange(tampered, result.signature, publicKey), false);
  });
});
