'use strict';

const { entryPatientId } = require('./sharded-host-persistence.js');

function entryJsonForSql(entry) {
  const copy = { ...entry };
  delete copy.labHistory;
  return JSON.stringify(copy);
}

function upsertRoomBundleRow(db, roomId, bundle) {
  db.prepare(
    `INSERT INTO lan_room_bundles (
      room_id, revision, entity_versions_json, agenda_json, todos_json, manejo_json,
      clinical_ops_json, delta_log_json, committed_at, audit_log_json,
      uploaded_by_client_id, entities_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id) DO UPDATE SET
      revision = excluded.revision,
      entity_versions_json = excluded.entity_versions_json,
      agenda_json = excluded.agenda_json,
      todos_json = excluded.todos_json,
      manejo_json = excluded.manejo_json,
      clinical_ops_json = excluded.clinical_ops_json,
      delta_log_json = excluded.delta_log_json,
      committed_at = excluded.committed_at,
      audit_log_json = excluded.audit_log_json,
      uploaded_by_client_id = excluded.uploaded_by_client_id,
      entities_json = excluded.entities_json`
  ).run(
    roomId,
    Number(bundle.revision || 0),
    JSON.stringify(bundle.entityVersions || {}),
    JSON.stringify(bundle.agenda || []),
    JSON.stringify(bundle.todos || {}),
    bundle.manejo != null ? JSON.stringify(bundle.manejo) : null,
    bundle.clinicalOps != null ? JSON.stringify(bundle.clinicalOps) : null,
    bundle.deltaLog != null ? JSON.stringify(bundle.deltaLog) : null,
    bundle.committedAt || null,
    JSON.stringify(bundle.audit_log || []),
    bundle.uploadedByClientId || null,
    JSON.stringify(bundle.entities || {})
  );
}

function upsertBundleEntryRow(db, roomId, patientId, entry) {
  const labMeta = entry.labMeta && typeof entry.labMeta === 'object' ? entry.labMeta : null;
  db.prepare(
    `INSERT INTO lan_bundle_entries (
      room_id, patient_id, entry_json, nota_version, indicaciones_version, lab_meta_json
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, patient_id) DO UPDATE SET
      entry_json = excluded.entry_json,
      nota_version = excluded.nota_version,
      indicaciones_version = excluded.indicaciones_version,
      lab_meta_json = excluded.lab_meta_json`
  ).run(
    roomId,
    patientId,
    entryJsonForSql(entry),
    entry._notaVersion != null ? Number(entry._notaVersion) : null,
    entry._indicacionesVersion != null ? Number(entry._indicacionesVersion) : null,
    labMeta ? JSON.stringify(labMeta) : null
  );
}

function commitRoomBundleSql(db, roomId, bundle) {
  upsertRoomBundleRow(db, roomId, bundle);
  const entries = Array.isArray(bundle.entries) ? bundle.entries : [];
  const seen = new Set();
  for (const entry of entries) {
    const patientId = entryPatientId(entry);
    if (!patientId) continue;
    seen.add(patientId);
    upsertBundleEntryRow(db, roomId, patientId, entry);
  }
  const existing = db
    .prepare('SELECT patient_id FROM lan_bundle_entries WHERE room_id = ?')
    .all(roomId)
    .map((r) => r.patient_id);
  for (const pid of existing) {
    if (!seen.has(pid)) {
      db.prepare(
        'DELETE FROM lan_bundle_entries WHERE room_id = ? AND patient_id = ?'
      ).run(roomId, pid);
      db.prepare('DELETE FROM lan_lab_sets WHERE room_id = ? AND patient_id = ?').run(
        roomId,
        pid
      );
      db.prepare('DELETE FROM lan_lab_set_order WHERE room_id = ? AND patient_id = ?').run(
        roomId,
        pid
      );
    }
  }
}

function commitMetaSql(db, state, roomRevisions) {
  const now = new Date().toISOString();
  const revs = roomRevisions || {};
  db.prepare(
    `INSERT INTO lan_host_meta (
      id, version, team_code_hash, patients_json, rooms_json, room_revisions_json,
      migration_generation, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, 3, ?)
    ON CONFLICT(id) DO UPDATE SET
      version = excluded.version,
      team_code_hash = excluded.team_code_hash,
      patients_json = excluded.patients_json,
      rooms_json = excluded.rooms_json,
      room_revisions_json = excluded.room_revisions_json,
      migration_generation = excluded.migration_generation,
      updated_at = excluded.updated_at`
  ).run(
    Number(state.version || 2),
    state.teamCodeHash,
    JSON.stringify(state.patients || []),
    JSON.stringify(state.rooms || []),
    JSON.stringify(revs),
    now
  );
}

module.exports = {
  entryJsonForSql,
  upsertRoomBundleRow,
  upsertBundleEntryRow,
  commitRoomBundleSql,
  commitMetaSql,
};
