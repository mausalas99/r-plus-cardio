'use strict';

function parseBundleEntryRow(er) {
  let entry;
  try {
    entry = JSON.parse(er.entry_json);
  } catch {
    entry = { id: er.patient_id };
  }
  if (er.lab_meta_json) {
    try {
      entry.labMeta = JSON.parse(er.lab_meta_json);
    } catch {
      entry.labMeta = null;
    }
  }
  if (er.nota_version != null) entry._notaVersion = er.nota_version;
  if (er.indicaciones_version != null) entry._indicacionesVersion = er.indicaciones_version;
  return entry;
}

function bundleFromSqlRow(row) {
  return {
    revision: Number(row.revision || 0),
    entityVersions: row.entity_versions_json ? JSON.parse(row.entity_versions_json) : {},
    agenda: row.agenda_json ? JSON.parse(row.agenda_json) : [],
    todos: row.todos_json ? JSON.parse(row.todos_json) : {},
    manejo: row.manejo_json ? JSON.parse(row.manejo_json) : null,
    clinicalOps: row.clinical_ops_json ? JSON.parse(row.clinical_ops_json) : null,
    deltaLog: row.delta_log_json ? JSON.parse(row.delta_log_json) : null,
    committedAt: row.committed_at || null,
    audit_log: row.audit_log_json ? JSON.parse(row.audit_log_json) : [],
    uploadedByClientId: row.uploaded_by_client_id || '',
    entities: row.entities_json ? JSON.parse(row.entities_json) : {},
    entries: [],
  };
}

function loadBundleForRoom(db, roomId) {
  const row = db.prepare('SELECT * FROM lan_room_bundles WHERE room_id = ?').get(roomId);
  if (!row) return null;
  const bundle = bundleFromSqlRow(row);
  const entryRows = db
    .prepare('SELECT * FROM lan_bundle_entries WHERE room_id = ?')
    .all(roomId);
  for (const er of entryRows) {
    bundle.entries.push(parseBundleEntryRow(er));
  }
  return bundle;
}

function collectRoomIds(db, rooms) {
  const roomRows = db.prepare('SELECT room_id FROM lan_room_bundles').all();
  return new Set([
    ...rooms.map((r) => r && r.id).filter(Boolean),
    ...roomRows.map((r) => r.room_id),
  ]);
}

function loadCacheFromSql(db, teamCodeHash) {
  const meta = db.prepare('SELECT * FROM lan_host_meta WHERE id = 1').get();
  if (!meta) return null;

  const roomSyncBundles = {};
  const rooms = JSON.parse(meta.rooms_json || '[]');
  const roomIds = collectRoomIds(db, rooms);

  for (const roomId of roomIds) {
    const bundle = loadBundleForRoom(db, roomId);
    if (bundle) roomSyncBundles[roomId] = bundle;
  }

  return {
    version: Number(meta.version || 2),
    teamCodeHash: meta.team_code_hash || teamCodeHash,
    patients: JSON.parse(meta.patients_json || '[]'),
    rooms,
    roomSyncBundles,
  };
}

module.exports = {
  parseBundleEntryRow,
  bundleFromSqlRow,
  loadBundleForRoom,
  collectRoomIds,
  loadCacheFromSql,
};
