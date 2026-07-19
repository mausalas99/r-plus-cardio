'use strict';

const { emptySidecar } = require('./lab-sidecar.js');

function loadSidecarFromSql(db, roomId, patientId) {
  const rows = db
    .prepare(
      `SELECT o.set_id, o.pos, s.set_json
       FROM lan_lab_set_order o
       JOIN lan_lab_sets s
         ON s.room_id = o.room_id AND s.patient_id = o.patient_id AND s.set_id = o.set_id
       WHERE o.room_id = ? AND o.patient_id = ?
       ORDER BY o.pos ASC`
    )
    .all(roomId, patientId);
  if (!rows.length) return emptySidecar();
  const setsById = {};
  const orderedIds = [];
  for (const row of rows) {
    orderedIds.push(row.set_id);
    try {
      setsById[row.set_id] = JSON.parse(row.set_json);
    } catch {
      setsById[row.set_id] = { id: row.set_id };
    }
  }
  return { setsById, orderedIds, updatedAt: new Date().toISOString() };
}

function writeSidecarToSql(db, roomId, patientId, sidecar) {
  db.prepare('DELETE FROM lan_lab_sets WHERE room_id = ? AND patient_id = ?').run(
    roomId,
    patientId
  );
  db.prepare('DELETE FROM lan_lab_set_order WHERE room_id = ? AND patient_id = ?').run(
    roomId,
    patientId
  );
  const orderedIds = Array.isArray(sidecar.orderedIds) ? sidecar.orderedIds : [];
  const insertSet = db.prepare(
    `INSERT INTO lan_lab_sets (room_id, patient_id, set_id, set_json, sort_date, client_timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertOrder = db.prepare(
    `INSERT INTO lan_lab_set_order (room_id, patient_id, pos, set_id) VALUES (?, ?, ?, ?)`
  );
  for (let pos = 0; pos < orderedIds.length; pos += 1) {
    const setId = orderedIds[pos];
    const set = sidecar.setsById && sidecar.setsById[setId];
    if (!set) continue;
    const sortDate = String(set.date || '1970-01-01');
    const clientTs = Number(set._clientTimestamp || 0);
    insertSet.run(roomId, patientId, setId, JSON.stringify(set), sortDate, clientTs);
    insertOrder.run(roomId, patientId, pos, setId);
  }
}

module.exports = { loadSidecarFromSql, writeSidecarToSql };
