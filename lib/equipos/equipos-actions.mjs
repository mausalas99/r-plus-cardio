import {
  normalizeEquiposDeviceType,
  normalizeEquiposRotation,
  normalizeReporterName,
  newEquiposId,
} from './equipos-constants.mjs';
import {
  getEquiposDevice,
  getOpenSessionForDevice,
  insertEquiposEvent,
  listWaitlistForDevice,
  resolvePurgeDeviceTypes,
} from './equipos-board.mjs';
import { EquiposError } from './equipos-errors.mjs';
import { closeEquiposSession, parseLumifyReturnFields } from './equipos-return-helpers.mjs';
import {
  canJoinEquiposWaitlist,
  resolveCheckoutQueueGate,
} from './equipos-queue-custody.mjs';

export { EquiposError } from './equipos-errors.mjs';

function validateIdentity(reporterName, rotation) {
  const name = normalizeReporterName(reporterName);
  const rot = normalizeEquiposRotation(rotation);
  if (!name) throw new EquiposError('invalid_name', 'Nombre inválido.');
  if (!rot) throw new EquiposError('invalid_rotation', 'Rotación inválida.');
  return { name, rot };
}

function hasActiveAlertOnDevice(db, deviceType) {
  const row = db
    .prepare(
      `SELECT 1 FROM equipos_team_reports WHERE device_type = ? AND active = 1 LIMIT 1`
    )
    .get(deviceType);
  return !!row;
}

function photoRequired(deviceType) {
  return deviceType === 'lumify' || deviceType === 'ekg';
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ deviceType: string, reporterName: string, rotation: string, pickupChargePct?: number|null, pickupPhotoId?: string|null }} input
 */
export function equiposCheckout(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inválido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const device = getEquiposDevice(db, deviceType);
  if (!device) throw new EquiposError('device_missing', 'Dispositivo no encontrado.');
  if (device.status !== 'available') {
    throw new EquiposError('not_available', 'El dispositivo no está disponible.');
  }
  if (hasActiveAlertOnDevice(db, deviceType)) {
    throw new EquiposError('alert_active', 'Hay un reporte activo en este dispositivo.');
  }
  if (photoRequired(deviceType) && !input.pickupPhotoId) {
    throw new EquiposError('photo_required', 'Se requiere foto al tomar el dispositivo.');
  }

  const waitlist = listWaitlistForDevice(db, deviceType);
  const gate = resolveCheckoutQueueGate(
    waitlist,
    name,
    rot,
    !!input.forceQueueBypass
  );

  let pickupCharge = null;
  if (deviceType === 'lumify' && input.pickupChargePct != null && input.pickupChargePct !== '') {
    const pct = Number(input.pickupChargePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new EquiposError('invalid_charge', 'Carga de tablet inválida.');
    }
    pickupCharge = Math.round(pct);
  }

  const now = new Date().toISOString();
  const sessionId = newEquiposId();
  db.prepare(
    `INSERT INTO equipos_sessions (
      id, device_type, holder_name, holder_rotation, checked_out_at,
      lumify_pickup_charge_pct, pickup_photo_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, deviceType, name, rot, now, pickupCharge, input.pickupPhotoId || null);

  db.prepare(
    `UPDATE equipos_device SET
      status = 'in_use',
      holder_name = ?, holder_rotation = ?,
      previous_holder_name = holder_name,
      previous_holder_rotation = holder_rotation,
      checked_out_at = ?, updated_at = ?
     WHERE device_type = ?`
  ).run(name, rot, now, now, deviceType);

  db.prepare(
    `DELETE FROM equipos_waitlist
     WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
  ).run(deviceType, name, rot);

  insertEquiposEvent(db, 'checkout', {
    deviceType,
    reporterName: name,
    rotation: rot,
    meta: {
      sessionId,
      queueBypassed: gate.bypassed,
    },
  });

  return {
    sessionId,
    deviceType,
    queueBypassed: gate.bypassed,
    notifyWaitlist: gate.bypassed ? gate.notifyWaitlist : [],
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ deviceType: string, reporterName: string, rotation: string, chargePct?: number, gelEmpty?: boolean, returnPhotoId?: string|null, adminForce?: boolean }} input
 */
export function equiposReturn(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inválido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const device = getEquiposDevice(db, deviceType);
  if (!device || device.status !== 'in_use') {
    throw new EquiposError('not_in_use', 'El dispositivo no está en uso.');
  }
  const isHolder =
    device.holder_name === name && device.holder_rotation === rot;
  if (!isHolder && !input.adminForce) {
    throw new EquiposError('not_holder', 'Solo quien lo tiene puede entregarlo.');
  }
  if (photoRequired(deviceType) && !input.returnPhotoId) {
    throw new EquiposError('photo_required', 'Se requiere foto al entregar.');
  }
  const { lumifyCharge, gelEmpty } = parseLumifyReturnFields(deviceType, input);

  const now = new Date().toISOString();
  const session = getOpenSessionForDevice(db, deviceType);
  if (session) {
    closeEquiposSession(db, session, {
      now,
      closedReason: input.adminForce ? 'admin_force_return' : 'return',
      lumifyCharge,
      gelEmpty,
      returnPhotoId: input.returnPhotoId || null,
    });
  }

  db.prepare(
    `UPDATE equipos_device SET
      status = 'available',
      previous_holder_name = holder_name,
      previous_holder_rotation = holder_rotation,
      holder_name = NULL, holder_rotation = NULL,
      checked_out_at = NULL,
      charge_pct = ?, gel_empty = ?, updated_at = ?
     WHERE device_type = ?`
  ).run(lumifyCharge, gelEmpty, now, deviceType);

  insertEquiposEvent(db, 'return', {
    deviceType,
    reporterName: name,
    rotation: rot,
  });

  const waitlist = listWaitlistForDevice(db, deviceType);
  return { deviceType, nextInQueue: waitlist[0] || null };
}

/** @param {import('better-sqlite3').Database} db @param {object} input */
export function equiposWaitlistJoin(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inválido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const device = getEquiposDevice(db, deviceType);
  if (!device || !canJoinEquiposWaitlist(device.status)) {
    throw new EquiposError('not_busy', 'No puedes entrar en la cola ahora.');
  }
  const dup = db
    .prepare(
      `SELECT id FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .get(deviceType, name, rot);
  if (dup) throw new EquiposError('already_queued', 'Ya estás en la cola.');

  const maxPos = db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM equipos_waitlist WHERE device_type = ?`)
    .get(deviceType);
  const id = newEquiposId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO equipos_waitlist (id, device_type, reporter_name, rotation, joined_at, position)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, deviceType, name, rot, now, (maxPos?.m || 0) + 1);

  insertEquiposEvent(db, 'waitlist_join', { deviceType, reporterName: name, rotation: rot });
  return { id };
}

/** @param {import('better-sqlite3').Database} db @param {object} input */
export function equiposWaitlistLeave(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const res = db
    .prepare(
      `DELETE FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .run(deviceType, name, rot);
  if (!res.changes) throw new EquiposError('not_in_queue', 'No estás en la cola.');
  insertEquiposEvent(db, 'waitlist_leave', { deviceType, reporterName: name, rotation: rot });
  return { ok: true };
}

/**
 * Defer one slot: swap position with the person immediately behind you.
 * Example queue A,B,C,D — B skips → A,C,B,D order; after C returns, B is next.
 *
 * @param {import('better-sqlite3').Database} db @param {object} input
 */
export function equiposWaitlistSkip(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inválido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const list = listWaitlistForDevice(db, deviceType);
  const myIndex = list.findIndex((r) => r.reporter_name === name && r.rotation === rot);
  if (myIndex < 0) throw new EquiposError('not_in_queue', 'No estás en la cola.');
  if (myIndex >= list.length - 1) {
    throw new EquiposError('cannot_skip', 'Eres el último en la cola.');
  }

  const me = list[myIndex];
  const behind = list[myIndex + 1];
  const myPos = me.position;
  db.prepare(`UPDATE equipos_waitlist SET position = ? WHERE id = ?`).run(behind.position, me.id);
  db.prepare(`UPDATE equipos_waitlist SET position = ? WHERE id = ?`).run(myPos, behind.id);

  const wasNext = myIndex === 0;
  insertEquiposEvent(db, 'waitlist_skip', {
    deviceType,
    reporterName: name,
    rotation: rot,
    meta: {
      deferredBehind: behind.reporter_name,
      deferredBehindRotation: behind.rotation,
    },
  });
  return {
    ok: true,
    wasNext,
    newNext: wasNext
      ? { reporterName: behind.reporter_name, rotation: behind.rotation }
      : null,
  };
}

/** @param {import('better-sqlite3').Database} db @param {object} input */
export function equiposCreateAlert(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  const kind = input.kind === 'malfunction' ? 'malfunction' : 'missing_material';
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const photoId = String(input.photoId || '').trim();
  if (!photoId) {
    throw new EquiposError('photo_required', 'Se requiere foto al reportar.');
  }
  const photo = getEquiposPhoto(db, photoId);
  if (!photo || photo.photo_kind !== 'alert') {
    throw new EquiposError('photo_invalid', 'Foto de reporte inválida.');
  }
  const id = newEquiposId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO equipos_team_reports (
      id, device_type, kind, message, reporter_name, rotation, created_at, active, photo_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, deviceType, kind, String(input.message || '').trim() || null, name, rot, now, photoId);

  db.prepare(`UPDATE equipos_photos SET report_id = ? WHERE id = ?`).run(id, photoId);

  db.prepare(
    `UPDATE equipos_device SET status = 'alert', updated_at = ? WHERE device_type = ?`
  ).run(now, deviceType);

  insertEquiposEvent(db, 'alert', {
    deviceType,
    reporterName: name,
    rotation: rot,
    meta: { kind, reportId: id, photoId },
  });
  return { id, photoId };
}

/** @param {import('better-sqlite3').Database} db @param {string} reportId @param {object} input */
export function equiposAckAlert(db, reportId, input) {
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const row = db.prepare(`SELECT * FROM equipos_team_reports WHERE id = ?`).get(reportId);
  if (!row || row.active !== 1) {
    throw new EquiposError('alert_missing', 'Reporte no encontrado o ya atendido.');
  }
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE equipos_team_reports SET
      active = 0, acknowledged_at = ?,
      acknowledged_by_name = ?, acknowledged_by_rotation = ?
     WHERE id = ?`
  ).run(now, name, rot, reportId);

  const other = db
    .prepare(
      `SELECT 1 FROM equipos_team_reports WHERE device_type = ? AND active = 1 LIMIT 1`
    )
    .get(row.device_type);
  if (!other) {
    const dev = getEquiposDevice(db, row.device_type);
    const newStatus = dev?.holder_name ? 'in_use' : 'available';
    db.prepare(
      `UPDATE equipos_device SET status = ?, updated_at = ? WHERE device_type = ?`
    ).run(newStatus, now, row.device_type);
  }

  insertEquiposEvent(db, 'alert_ack', {
    deviceType: row.device_type,
    reporterName: name,
    rotation: rot,
    meta: { reportId },
  });
  return { ok: true };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ deviceType?: string, adminUserId?: string, adminName?: string }} input
 */
export function equiposAdminPurgeQueue(db, input) {
  const targets = resolvePurgeDeviceTypes(input.deviceType || 'all');
  if (!targets.length) throw new EquiposError('invalid_device', 'Dispositivo inválido.');

  const now = new Date().toISOString();
  const results = [];

  for (const deviceType of targets) {
    const cleared = db
      .prepare(`DELETE FROM equipos_waitlist WHERE device_type = ?`)
      .run(deviceType).changes;
    const device = getEquiposDevice(db, deviceType);
    let hadCustody = false;
    if (device?.status === 'in_use') {
      hadCustody = true;
      const session = getOpenSessionForDevice(db, deviceType);
      if (session) {
        const checked = Date.parse(session.checked_out_at);
        const duration = Math.max(0, Math.round((Date.now() - checked) / 1000));
        db.prepare(
          `UPDATE equipos_sessions SET returned_at = ?, duration_seconds = ?, closed_reason = 'admin_purge'
           WHERE id = ?`
        ).run(now, duration, session.id);
      }
      db.prepare(
        `UPDATE equipos_device SET
          status = 'available',
          previous_holder_name = holder_name,
          previous_holder_rotation = holder_rotation,
          holder_name = NULL, holder_rotation = NULL,
          checked_out_at = NULL, updated_at = ?
         WHERE device_type = ?`
      ).run(now, deviceType);
    }
    insertEquiposEvent(db, 'admin_purge_queue', {
      deviceType,
      reporterName: input.adminName || 'Admin',
      meta: {
        clearedWaitlistCount: cleared,
        hadCustody,
        adminUserId: input.adminUserId || null,
      },
    });
    results.push({ deviceType, cleared, hadCustody });
  }
  return results;
}

/** @param {import('better-sqlite3').Database} db @param {object} row */
export function insertEquiposPhotoRow(db, row) {
  db.prepare(
    `INSERT INTO equipos_photos (id, session_id, report_id, device_type, photo_kind, file_path, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.sessionId || null,
    row.reportId || null,
    row.deviceType,
    row.photoKind,
    row.filePath,
    row.capturedAt
  );
}

/** @param {import('better-sqlite3').Database} db @param {string[]} photoIds */
export function clearEquiposPhotoReferences(db, photoIds) {
  if (!photoIds.length) return;
  const placeholders = photoIds.map(() => '?').join(',');
  db.prepare(
    `UPDATE equipos_sessions SET pickup_photo_id = NULL WHERE pickup_photo_id IN (${placeholders})`
  ).run(...photoIds);
  db.prepare(
    `UPDATE equipos_sessions SET return_photo_id = NULL WHERE return_photo_id IN (${placeholders})`
  ).run(...photoIds);
  db.prepare(
    `UPDATE equipos_team_reports SET photo_id = NULL WHERE photo_id IN (${placeholders})`
  ).run(...photoIds);
  db.prepare(`DELETE FROM equipos_photos WHERE id IN (${placeholders})`).run(...photoIds);
}

/** @param {import('better-sqlite3').Database} db @param {string} photoId */
export function getEquiposPhoto(db, photoId) {
  return db.prepare(`SELECT * FROM equipos_photos WHERE id = ?`).get(photoId);
}
