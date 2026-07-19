/**
 * Renderer bridge for P2P clinical signing (main process performs crypto via IPC).
 */

function api() {
  return typeof window !== 'undefined' ? window.electronAPI : null;
}

/**
 * @param {{ userId: string, privateKeyPem: string, patientId: string, actionType: string, deltaData: unknown, lastBlockHash: string }} params
 */
export async function signClinicalChange(params) {
  const electron = api();
  if (!electron || typeof electron.dbSignClinicalChange !== 'function') {
    throw new Error('Clinical signing unavailable in this environment');
  }
  const res = await electron.dbSignClinicalChange(params);
  if (!res || res.ok === false) {
    throw new Error(res?.error || 'SIGN_FAILED');
  }
  return res.signed;
}

/**
 * @param {Record<string, unknown>} transactionBody
 * @param {string} signatureHex
 * @param {string} publicPemKey
 */
export async function verifyIncomingPeerChange(transactionBody, signatureHex, publicPemKey) {
  const electron = api();
  if (!electron || typeof electron.dbVerifyClinicalChange !== 'function') {
    return false;
  }
  const res = await electron.dbVerifyClinicalChange({
    transactionBody,
    signature: signatureHex,
    publicKeyPem: publicPemKey,
  });
  return !!(res && res.ok && res.valid);
}
