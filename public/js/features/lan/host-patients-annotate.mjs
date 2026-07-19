/** Pure helpers for LAN host patient census rows (no transport/orchestrator imports).
 * Mirror of lan-squad/host-patient-ownership.js — keep both in sync.
 * clientId is bound via X-Client-Token when available (plan 010); query fallback is
 * audited; isProgramAdmin remains a client assertion pending RBAC.
 */

/** @param {object|null|undefined} row */
export function resolveHostPatientOwnerClientId(row) {
  const audit = Array.isArray(row?.audit_log) ? row.audit_log : [];
  const createEntry =
    audit.find(function (e) {
      return e && e.action === 'patient.create';
    }) || null;
  return String(createEntry?.clientId || '').trim();
}

/**
 * True when another LAN device registered the chart (this client should not purge it).
 * @param {object|null|undefined} row
 * @param {string} [localClientId]
 */
export function isHostPatientOwnedByOtherClient(row, localClientId) {
  const local = String(localClientId || '').trim();
  const ownerClientId = resolveHostPatientOwnerClientId(row);
  if (!local || !ownerClientId || ownerClientId === 'host') return false;
  return ownerClientId !== local;
}

/**
 * Host row without local copy, archived, or bundle-only orphan.
 * @param {object} row
 * @param {object|null} local
 * @param {string} status
 */
export function isInactiveHostPatientRow(row, local, status) {
  if (status === 'ghost') return true;
  if (row?.archived === true) return true;
  if (local?.archived === true) return true;
  if (row?._bundleOnly === true) return true;
  return false;
}

/**
 * Host census row eligible for «Eliminar fantasmas» (own ghosts + bundle-only stubs).
 * @param {object|null|undefined} item
 * @param {string} [localClientId]
 */
export function isPurgeableHostCensusRow(item, localClientId) {
  if (!item) return false;
  if (isHostPatientOwnedByOtherClient(item.row, localClientId)) return false;
  if (item.status === 'ghost') return true;
  return item.row?._bundleOnly === true;
}

/** @param {object[]} rows @param {object[]} [localPatients] */
export function annotateLanHostPatientRows(rows, localPatients) {
  const localById = new Map();
  const localByRegistro = new Map();
  for (const p of localPatients || []) {
    if (!p?.id) continue;
    localById.set(String(p.id), p);
    const reg = String(p.registro || '').trim();
    if (reg) localByRegistro.set(reg, p);
  }
  return (rows || [])
    .map(function (row) {
      const id = String(row.id || '');
      let local = localById.get(id) || null;
      const reg = String(row.registro || '').trim();
      if (!local && reg) {
        const byReg = localByRegistro.get(reg);
        if (byReg && String(byReg.id) === id) {
          local = byReg;
        }
      }
      const status = local ? 'local' : 'ghost';
      return {
        row: row,
        local: local,
        status: status,
        inactive: isInactiveHostPatientRow(row, local, status),
      };
    })
    .sort(function (a, b) {
      return String(a.row.nombre || '').localeCompare(String(b.row.nombre || ''), 'es');
    });
}
