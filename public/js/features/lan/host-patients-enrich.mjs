/**
 * Enrich LAN host census rows with team, registrar, and timestamps.
 * Pure module — no transport/orchestrator imports.
 */

import { resolvePatientTeamIdFromAssignments } from '../../clinico-access.mjs';
import { normalizeUsername } from '../../clinical-username.mjs';
import {
  buildClinicalOpsLookups as buildLookupsFromOps,
  resolveRegistrarFromAudit,
} from './host-patients-enrich-lookups.mjs';

/** @param {object|null|undefined} clinicalOps */
export function buildClinicalOpsLookups(clinicalOps) {
  return buildLookupsFromOps(clinicalOps);
}

/** @param {string} clientId @param {object} lookups */
export function resolveUserIdFromLanClientId(clientId, lookups) {
  const raw = String(clientId || '').trim();
  if (!raw || raw === 'host') return '';
  const byExact = lookups.usersByUsername?.get(raw);
  if (byExact?.user_id) return String(byExact.user_id);
  const byNormalized = lookups.usersByUsername?.get(normalizeUsername(raw));
  if (byNormalized?.user_id) return String(byNormalized.user_id);
  return '';
}

/** @param {object|null|undefined} user */
export function formatClinicalUserLabel(user) {
  if (!user) return '';
  const handleRaw = String(user.username || '').trim().replace(/^@/, '');
  const handle = handleRaw ? '@' + handleRaw : '';
  const name = String(user.clinical_name || user.display_name || '').trim();
  const rank = String(user.rank || '').trim();
  const rankPrefix = rank ? rank + ' ' : '';
  if (name && handle) return rankPrefix + name + ' · ' + handle;
  if (name) return rankPrefix + name;
  return handle ? rankPrefix + handle : '';
}

/**
 * @param {string} iso
 * @returns {string}
 */
export function formatLanHostTimestamp(iso) {
  const raw = String(iso || '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @param {string} iso
 * @returns {number}
 */
export function timestampMillis(iso) {
  const ms = new Date(String(iso || '')).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** @param {object} row */
export function resolvePatientUpdatedAt(row) {
  return String(row?.updatedAt || row?.lanUpdatedAt || '').trim();
}

/** @param {object} row @param {object} lookups @param {{ localClientId?: string, localUser?: object|null }} [opts] */
export function resolvePatientRegistrarUserId(row, lookups, opts) {
  const explicit = String(row?.registeredByUserId || '').trim();
  if (explicit) return explicit;
  return resolveRegistrarFromAudit(row, lookups, opts, resolveUserIdFromLanClientId);
}

/** @param {object} row @param {object} lookups @param {{ localClientId?: string, localUser?: object|null }} [opts] */
export function resolvePatientRegistrarLabel(row, lookups, opts) {
  const uid = resolvePatientRegistrarUserId(row, lookups, opts);
  if (uid) {
    const label = formatClinicalUserLabel(lookups.usersById.get(uid));
    if (label) return label;
  }
  const audit = Array.isArray(row?.audit_log) ? row.audit_log : [];
  const createEntry =
    audit.find(function (e) {
      return e && e.action === 'patient.create';
    }) || null;
  const createClientId = String(createEntry?.clientId || '').trim();
  if (createClientId && createClientId !== 'host') {
    return 'Dispositivo ···' + createClientId.slice(-6);
  }
  return '—';
}

/** @param {object} row @param {object} lookups */
export function resolvePatientTeamId(row, lookups) {
  return resolvePatientTeamIdFromAssignments(String(row?.id || ''), lookups.assignments);
}

/** @param {object} row @param {object} lookups */
export function resolvePatientTeamLabel(row, lookups) {
  const teamId = resolvePatientTeamId(row, lookups);
  if (!teamId) return 'Sin equipo';
  const team = lookups.teamsById.get(teamId);
  if (!team) return 'Equipo ' + teamId.slice(0, 8);
  const name = String(team.name || '').trim() || 'Equipo';
  const service = String(team.service || '').trim();
  const fraction = String(team.sub_area_fraction || '').trim();
  const bits = [name];
  if (service) bits.push(service);
  if (fraction) bits.push(fraction);
  return bits.join(' · ');
}

/**
 * @param {Array<{ row: object, local: object|null, status: string }>} annotated
 * @param {object|null|undefined} clinicalOps
 * @param {{ localClientId?: string, localUser?: object|null }} [opts]
 */
export function enrichLanHostPatientRows(annotated, clinicalOps, opts) {
  const lookups = buildClinicalOpsLookups(clinicalOps);
  return (annotated || []).map(function (item) {
    const updatedAt = resolvePatientUpdatedAt(item.row);
    const teamId = resolvePatientTeamId(item.row, lookups);
    return {
      ...item,
      teamId: teamId,
      teamLabel: resolvePatientTeamLabel(item.row, lookups),
      registrarLabel: resolvePatientRegistrarLabel(item.row, lookups, opts),
      updatedAt: updatedAt,
      updatedAtMs: timestampMillis(updatedAt),
      registrarUserId: resolvePatientRegistrarUserId(item.row, lookups, opts),
    };
  });
}
