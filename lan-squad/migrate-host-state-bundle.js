'use strict';

function resolveEntityVersions(bundle, buildEntityVersionsFromBundle) {
  if (bundle.entityVersions && typeof bundle.entityVersions === 'object') {
    return bundle.entityVersions;
  }
  return buildEntityVersionsFromBundle(bundle);
}

function resolveAgenda(bundle) {
  return Array.isArray(bundle.agenda) ? bundle.agenda : [];
}

function resolveTodos(bundle) {
  return bundle.todos && typeof bundle.todos === 'object' ? bundle.todos : {};
}

function resolveEntries(bundle) {
  return Array.isArray(bundle.entries) ? bundle.entries : [];
}

function resolveObjectOrNull(value) {
  return value && typeof value === 'object' ? value : null;
}

function resolveAuditLog(bundle) {
  return Array.isArray(bundle.audit_log) ? bundle.audit_log : [];
}

function resolveCommittedAt(bundle) {
  return String(bundle.committedAt || bundle.updatedAt || new Date().toISOString());
}

function buildMigratedBundleV2(bundle, buildEntityVersionsFromBundle) {
  return {
    revision: Number(bundle.revision || 1),
    entityVersions: resolveEntityVersions(bundle, buildEntityVersionsFromBundle),
    agenda: resolveAgenda(bundle),
    todos: resolveTodos(bundle),
    entries: resolveEntries(bundle),
    manejo: resolveObjectOrNull(bundle.manejo),
    clinicalOps: resolveObjectOrNull(bundle.clinicalOps),
    uploadedByClientId: String(bundle.uploadedByClientId || ''),
    committedAt: resolveCommittedAt(bundle),
    audit_log: resolveAuditLog(bundle),
  };
}

module.exports = {
  buildMigratedBundleV2,
  resolveEntityVersions,
  resolveAgenda,
  resolveTodos,
  resolveEntries,
  resolveObjectOrNull,
  resolveAuditLog,
  resolveCommittedAt,
};
