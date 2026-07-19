import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signClinicalChange, verifyIncomingPeerChange } from './clinical-crypto.mjs';

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

describe('clinical-crypto', () => {
  it('blockHash chains serialized payload with signature', () => {
    const { privateKey } = generateKeyPair();
    const result = signClinicalChange({
      userId: 'u',
      privateKeyPem: privateKey,
      patientId: 'p',
      actionType: 'X',
      deltaData: {},
      lastBlockHash: '0',
    });
    const expected = crypto
      .createHash('sha256')
      .update(JSON.stringify(result.transactionBody) + result.signature)
      .digest('hex');
    assert.equal(result.blockHash, expected);
  });

  it('verifyIncomingPeerChange validates signature', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const result = signClinicalChange({
      userId: 'u',
      privateKeyPem: privateKey,
      patientId: 'p',
      actionType: 'X',
      deltaData: { a: 1 },
      lastBlockHash: '0',
    });
    assert.equal(
      verifyIncomingPeerChange(result.transactionBody, result.signature, publicKey),
      true
    );
  });
});
