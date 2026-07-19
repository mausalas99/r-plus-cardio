import { extractPatientFromBundleEntry } from './host-patients-bundle-entry.mjs';
import { mergePatientRegistrationMeta } from '../../patient-registration-meta.mjs';

/** @param {object[]|null|undefined} a @param {object[]|null|undefined} b */
function mergeHostCensusAuditLogs(a, b) {
  const out = Array.isArray(a) ? a.slice() : [];
  const seen = new Set(out.map(function (e) {
    return JSON.stringify(e);
  }));
  for (const entry of Array.isArray(b) ? b : []) {
    const key = JSON.stringify(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * @param {Map<string, object>} byId
 * @param {object} row
 * @param {{ bundleOnly?: boolean }} [meta]
 */
export function upsertHostCensusPatient(byId, row, meta) {
  if (!row?.id) return;
  const id = String(row.id);
  if (id.indexOf('demo-') === 0) return;
  const existing = byId.get(id);
  if (!existing) {
    byId.set(id, meta?.bundleOnly ? Object.assign({ _bundleOnly: true }, row) : { ...row });
    return;
  }
  const merged = Object.assign({}, existing, row);
  const regHolder = {
    registeredByUserId: merged.registeredByUserId,
    registeredAt: merged.registeredAt,
  };
  mergePatientRegistrationMeta(regHolder, existing);
  mergePatientRegistrationMeta(regHolder, row);
  merged.registeredByUserId = regHolder.registeredByUserId;
  merged.registeredAt = regHolder.registeredAt;
  merged.audit_log = mergeHostCensusAuditLogs(existing.audit_log, row.audit_log);
  if (!meta?.bundleOnly) {
    delete merged._bundleOnly;
  }
  byId.set(id, merged);
}

/**
 * @param {Map<string, object>} byId
 * @param {object[]} entries
 */
export function mergeBundleEntriesIntoCensus(byId, entries) {
  for (const entry of entries || []) {
    const p = extractPatientFromBundleEntry(entry);
    if (!p) continue;
    upsertHostCensusPatient(byId, p, { bundleOnly: true });
  }
}
