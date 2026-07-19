import { patients } from '../app-state.mjs';
import { evaluateClinicalScope } from '../clinico-access.mjs';
import { signClinicalChange, verifyIncomingPeerChange } from '../features/crypto-signer.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { getClinicalScopeContextForEvaluate } from './scope-evaluate.mjs';

/**
 * @param {string|null|undefined} patientId
 * @param {Record<string, unknown>|null|undefined} [settings]
 */
export function assertClinicalWriteAllowed(patientId, settings) {
  void settings;
  const patient =
    patients.find((p) => String(p.id) === String(patientId)) ||
    (patientId ? { id: patientId } : null);
  const guardia = patientId ? clinicalSessionContext.guardiasMap.get(String(patientId)) : null;
  const scope = evaluateClinicalScope(
    clinicalSessionContext.user,
    patient,
    guardia,
    getClinicalScopeContextForEvaluate()
  );
  if (!scope.writable) {
    const err = new Error(scope.reasoning || 'Clinical write denied');
    err.code = 'CLINICAL_ACCESS_DENIED';
    throw err;
  }
  return scope;
}

/**
 * @param {object} mutation
 * @param {string} actionType
 */
export async function signOutgoingLiveSyncMutation(mutation, actionType) {
  const user = clinicalSessionContext.user;
  const privateKey = clinicalSessionContext.decryptedPrivateKeyPem;
  if (!user || !privateKey || !mutation) return null;

  const patientId = String(mutation.patientId || mutation.entityId || '');
  if (!patientId) return null;

  const deltaData = mutation.data || mutation.changedKeys || mutation;
  const lastBlockHash =
    clinicalSessionContext.lastBlockHashByPatient.get(patientId) || 'genesis';

  const signed = await signClinicalChange({
    userId: user.user_id,
    privateKeyPem: privateKey,
    patientId,
    actionType: actionType || mutation.entityType || 'clinical.mutation',
    deltaData,
    lastBlockHash,
  });

  clinicalSessionContext.lastBlockHashByPatient.set(patientId, signed.blockHash);
  return signed;
}

/**
 * @param {{ transactionBody: object, signature: string }} clinicalLedger
 * @param {string} publicKeyPem
 */
export async function verifyIncomingClinicalLedger(clinicalLedger, publicKeyPem) {
  if (!clinicalLedger || !publicKeyPem) return false;
  return verifyIncomingPeerChange(
    clinicalLedger.transactionBody,
    clinicalLedger.signature,
    publicKeyPem
  );
}

/**
 * @param {object} mutation
 * @param {object} [envelope]
 */
export async function guardAndSignLiveSyncMutation(mutation, envelope) {
  const patientId = mutation?.patientId || mutation?.entityId;
  if (patientId) assertClinicalWriteAllowed(String(patientId));
  const signed = await signOutgoingLiveSyncMutation(mutation, mutation?.op || mutation?.entityType);
  if (signed && envelope && typeof envelope === 'object') {
    envelope.clinicalLedger = signed;
  }
  return signed;
}
