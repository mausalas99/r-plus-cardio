'use strict';

const { SECTION_KEYS, META_KEYS, isPlainObject, migrateLegacyHistoriaData } = require('./historia-clinica-validate-core.js');

function validateVersionAndKeys(body) {
  const expectedVersion = Number(body.expectedVersion ?? 0);
  if (!Number.isFinite(expectedVersion) || expectedVersion < 0) {
    return { ok: false, error: 'invalid_expectedVersion', paths: ['expectedVersion'] };
  }
  const changedKeys = Array.isArray(body.changedKeys) ? body.changedKeys : [];
  if (expectedVersion > 0 && !changedKeys.length) {
    return { ok: false, error: 'changedKeys_required', paths: ['changedKeys'] };
  }
  for (const k of changedKeys) {
    if (!SECTION_KEYS.has(k) && !META_KEYS.has(k)) {
      return { ok: false, error: 'invalid_changedKey', paths: ['changedKeys'] };
    }
  }
  return { ok: true, expectedVersion, changedKeys };
}

function validateRoomAndData(body) {
  const roomId = String(body.roomId || '').trim();
  if (!roomId) {
    return { ok: false, error: 'roomId_required', paths: ['roomId'] };
  }
  if (!isPlainObject(body.data)) {
    return { ok: false, error: 'data_required', paths: ['data'] };
  }
  return { ok: true, roomId, data: migrateLegacyHistoriaData(body.data) };
}

function validateAuditField(body) {
  if (body.audit == null) return { ok: true };
  if (!isPlainObject(body.audit)) {
    return { ok: false, error: 'invalid_audit', paths: ['audit'] };
  }
  if (!Array.isArray(body.audit.safety)) return { ok: true };
  for (const s of body.audit.safety) {
    if (!s || typeof s.ruleId !== 'string') {
      return { ok: false, error: 'invalid_audit_safety', paths: ['audit.safety'] };
    }
  }
  return { ok: true };
}

function buildHistoriaMutation(body, expectedVersion, changedKeys, roomId, data) {
  return {
    entityType: 'historiaClinica',
    entityId: String(body.patientId || body.entityId || ''),
    patientId: String(body.patientId || body.entityId || ''),
    roomId,
    expectedVersion,
    changedKeys,
    baseData: body.baseData,
    data,
    op: body.op,
    audit: body.audit,
    clientId: body.clientId,
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, mutation: object } | { ok: false, error: string, paths?: string[] }}
 */
function validateHistoriaClinicaPut(body) {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  const versionResult = validateVersionAndKeys(body);
  if (!versionResult.ok) return versionResult;
  const roomResult = validateRoomAndData(body);
  if (!roomResult.ok) return roomResult;
  const auditResult = validateAuditField(body);
  if (!auditResult.ok) return auditResult;
  return {
    ok: true,
    mutation: buildHistoriaMutation(
      body,
      versionResult.expectedVersion,
      versionResult.changedKeys,
      roomResult.roomId,
      roomResult.data
    ),
  };
}

module.exports = {
  validateHistoriaClinicaPut,
  validateVersionAndKeys,
  validateRoomAndData,
  validateAuditField,
  buildHistoriaMutation,
};
