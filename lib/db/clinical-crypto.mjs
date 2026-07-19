import crypto from 'node:crypto';

/**
 * @param {{ userId: string, privateKeyPem: string, patientId: string, actionType: string, deltaData: unknown, lastBlockHash: string }} params
 */
export function signClinicalChange({ userId, privateKeyPem, patientId, actionType, deltaData, lastBlockHash }) {
  const timestamp = new Date().toISOString();
  const deltaHash = crypto.createHash('sha256').update(JSON.stringify(deltaData)).digest('hex');
  const transactionBody = { timestamp, userId, patientId, actionType, deltaHash, lastBlockHash };
  const serializedPayload = JSON.stringify(transactionBody);

  const signer = crypto.createSign('SHA256');
  signer.update(serializedPayload);
  const signatureHex = signer.sign(privateKeyPem, 'hex');

  return {
    transactionBody,
    signature: signatureHex,
    blockHash: crypto.createHash('sha256').update(serializedPayload + signatureHex).digest('hex'),
  };
}

/**
 * @param {Record<string, unknown>} transactionBody
 * @param {string} signatureHex
 * @param {string} publicPemKey
 */
export function verifyIncomingPeerChange(transactionBody, signatureHex, publicPemKey) {
  const serializedPayload = JSON.stringify(transactionBody);
  const verifier = crypto.createVerify('SHA256');
  verifier.update(serializedPayload);
  return verifier.verify(publicPemKey, signatureHex, 'hex');
}
