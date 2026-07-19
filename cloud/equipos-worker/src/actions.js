import {
  normalizeEquiposDeviceType,
  normalizeEquiposRotation,
  normalizeReporterName,
  newEquiposId,
} from './constants.js';
import { EquiposError } from './errors.js';
import {
  getEquiposDevice,
  getOpenSessionForDevice,
  insertEquiposEvent,
  listWaitlistForDevice,
  resolvePurgeDeviceTypes,
  getEquiposPhoto,
} from './board.js';
import {
  canJoinEquiposWaitlist,
  resolveCheckoutQueueGate,
} from '../../../lib/equipos/equipos-queue-custody.mjs';

export { getEquiposPhoto };

function validateIdentity(reporterName, rotation) {
  const name = normalizeReporterName(reporterName);
  const rot = normalizeEquiposRotation(rotation);
  if (!name) throw new EquiposError('invalid_name', 'Nombre inv?lido.');
  if (!rot) throw new EquiposError('invalid_rotation', 'Rotaci?n inv?lida.');
  return { name, rot };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} deviceType */
async function hasActiveAlertOnDevice(db, deviceType) {
  const row = await db
    .prepare(`SELECT 1 AS x FROM equipos_team_reports WHERE device_type = ? AND active = 1 LIMIT 1`)
    .bind(deviceType)
    .first();
  return !!row;
}

/** @param {string} deviceType */
function photoRequired(deviceType) {
  return deviceType === 'lumify' || deviceType === 'ekg';
}

/** @param {string} deviceType @param {object} input */
function parseLumifyReturnFields(deviceType, input) {
  if (deviceType !== 'lumify') return { lumifyCharge: null, gelEmpty: null };
  const pct = Number(input.chargePct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new EquiposError('charge_required', 'La carga de tablet es obligatoria al entregar.');
  }
  if (input.gelEmpty === undefined || input.gelEmpty === null) {
    throw new EquiposError('gel_required', 'Indica si el gel est? vac?o.');
  }
  return { lumifyCharge: Math.round(pct), gelEmpty: input.gelEmpty ? 1 : 0 };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} session @param {object} fields */
async function closeEquiposSession(db, session, fields) {
  const checked = Date.parse(session.checked_out_at);
  const duration = Math.max(0, Math.round((Date.now() - checked) / 1000));
  await db
    .prepare(
      `UPDATE equipos_sessions SET
        returned_at = ?, duration_seconds = ?, closed_reason = ?,
        lumify_charge_pct = ?, lumify_gel_empty = ?, return_photo_id = ?
       WHERE id = ?`
    )
    .bind(
      fields.now,
      duration,
      fields.closedReason,
      fields.lumifyCharge,
      fields.gelEmpty,
      fields.returnPhotoId,
      session.id
    )
    .run();
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function equiposCheckout(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inv?lido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const device = await getEquiposDevice(db, deviceType);
  if (!device) throw new EquiposError('device_missing', 'Dispositivo no encontrado.');
  if (device.status !== 'available') {
    throw new EquiposError('not_available', 'El dispositivo no est? disponible.');
  }
  if (await hasActiveAlertOnDevice(db, deviceType)) {
    throw new EquiposError('alert_active', 'Hay un reporte activo en este dispositivo.');
  }
  if (photoRequired(deviceType) && !input.pickupPhotoId) {
    throw new EquiposError('photo_required', 'Se requiere foto al tomar el dispositivo.');
  }

  const waitlist = await listWaitlistForDevice(db, deviceType);
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
      throw new EquiposError('invalid_charge', 'Carga de tablet inv?lida.');
    }
    pickupCharge = Math.round(pct);
  }

  const now = new Date().toISOString();
  const sessionId = newEquiposId();
  await db
    .prepare(
      `INSERT INTO equipos_sessions (
        id, device_type, holder_name, holder_rotation, checked_out_at,
        lumify_pickup_charge_pct, pickup_photo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(sessionId, deviceType, name, rot, now, pickupCharge, input.pickupPhotoId || null)
    .run();

  await db
    .prepare(
      `UPDATE equipos_device SET
        status = 'in_use',
        holder_name = ?, holder_rotation = ?,
        previous_holder_name = holder_name,
        previous_holder_rotation = holder_rotation,
        checked_out_at = ?, updated_at = ?
       WHERE device_type = ?`
    )
    .bind(name, rot, now, now, deviceType)
    .run();

  await db
    .prepare(
      `DELETE FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(deviceType, name, rot)
    .run();

  await insertEquiposEvent(db, 'checkout', {
    deviceType,
    reporterName: name,
    rotation: rot,
    meta: { sessionId, queueBypassed: gate.bypassed },
  });

  return {
    sessionId,
    deviceType,
    queueBypassed: gate.bypassed,
    notifyWaitlist: gate.bypassed ? gate.notifyWaitlist : [],
  };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function equiposReturn(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inv?lido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const device = await getEquiposDevice(db, deviceType);
  if (!device || device.status !== 'in_use') {
    throw new EquiposError('not_in_use', 'El dispositivo no est? en uso.');
  }
  const isHolder = device.holder_name === name && device.holder_rotation === rot;
  if (!isHolder && !input.adminForce) {
    throw new EquiposError('not_holder', 'Solo quien lo tiene puede entregarlo.');
  }
  if (photoRequired(deviceType) && !input.returnPhotoId) {
    throw new EquiposError('photo_required', 'Se requiere foto al entregar.');
  }
  const { lumifyCharge, gelEmpty } = parseLumifyReturnFields(deviceType, input);

  const now = new Date().toISOString();
  const session = await getOpenSessionForDevice(db, deviceType);
  if (session) {
    await closeEquiposSession(db, session, {
      now,
      closedReason: input.adminForce ? 'admin_force_return' : 'return',
      lumifyCharge,
      gelEmpty,
      returnPhotoId: input.returnPhotoId || null,
    });
  }

  await db
    .prepare(
      `UPDATE equipos_device SET
        status = 'available',
        previous_holder_name = holder_name,
        previous_holder_rotation = holder_rotation,
        holder_name = NULL, holder_rotation = NULL,
        checked_out_at = NULL,
        charge_pct = ?, gel_empty = ?, updated_at = ?
       WHERE device_type = ?`
    )
    .bind(lumifyCharge, gelEmpty, now, deviceType)
    .run();

  await insertEquiposEvent(db, 'return', { deviceType, reporterName: name, rotation: rot });

  const waitlist = await listWaitlistForDevice(db, deviceType);
  return { deviceType, nextInQueue: waitlist[0] || null };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function equiposWaitlistJoin(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inv?lido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const device = await getEquiposDevice(db, deviceType);
  if (!device || !canJoinEquiposWaitlist(device.status)) {
    throw new EquiposError('not_busy', 'No puedes entrar en la cola ahora.');
  }
  const dup = await db
    .prepare(
      `SELECT id FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(deviceType, name, rot)
    .first();
  if (dup) throw new EquiposError('already_queued', 'Ya est?s en la cola.');

  const maxPos = await db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM equipos_waitlist WHERE device_type = ?`)
    .bind(deviceType)
    .first();
  const id = newEquiposId();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO equipos_waitlist (id, device_type, reporter_name, rotation, joined_at, position)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, deviceType, name, rot, now, (maxPos?.m || 0) + 1)
    .run();

  await insertEquiposEvent(db, 'waitlist_join', { deviceType, reporterName: name, rotation: rot });
  return { id };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function equiposWaitlistLeave(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const res = await db
    .prepare(
      `DELETE FROM equipos_waitlist
       WHERE device_type = ? AND reporter_name = ? AND rotation = ?`
    )
    .bind(deviceType, name, rot)
    .run();
  if (!res.meta.changes) throw new EquiposError('not_in_queue', 'No est?s en la cola.');
  await insertEquiposEvent(db, 'waitlist_leave', { deviceType, reporterName: name, rotation: rot });
  return { ok: true };
}

/**
 * Defer one slot: swap position with the person immediately behind you.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db @param {object} input
 */
export async function equiposWaitlistSkip(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  if (!deviceType) throw new EquiposError('invalid_device', 'Dispositivo inv?lido.');
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const list = await listWaitlistForDevice(db, deviceType);
  const myIndex = list.findIndex((r) => r.reporter_name === name && r.rotation === rot);
  if (myIndex < 0) throw new EquiposError('not_in_queue', 'No est?s en la cola.');
  if (myIndex >= list.length - 1) {
    throw new EquiposError('cannot_skip', 'Eres el ?ltimo en la cola.');
  }

  const me = list[myIndex];
  const behind = list[myIndex + 1];
  const myPos = me.position;
  await db
    .prepare(`UPDATE equipos_waitlist SET position = ? WHERE id = ?`)
    .bind(behind.position, me.id)
    .run();
  await db
    .prepare(`UPDATE equipos_waitlist SET position = ? WHERE id = ?`)
    .bind(myPos, behind.id)
    .run();

  const wasNext = myIndex === 0;
  await insertEquiposEvent(db, 'waitlist_skip', {
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

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function equiposCreateAlert(db, input) {
  const deviceType = normalizeEquiposDeviceType(input.deviceType);
  const kind = input.kind === 'malfunction' ? 'malfunction' : 'missing_material';
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const photoId = String(input.photoId || '').trim();
  if (!photoId) throw new EquiposError('photo_required', 'Se requiere foto al reportar.');
  const photo = await getEquiposPhoto(db, photoId);
  if (!photo || photo.photo_kind !== 'alert') {
    throw new EquiposError('photo_invalid', 'Foto de reporte inv?lida.');
  }
  const id = newEquiposId();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO equipos_team_reports (
        id, device_type, kind, message, reporter_name, rotation, created_at, active, photo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(id, deviceType, kind, String(input.message || '').trim() || null, name, rot, now, photoId)
    .run();

  await db.prepare(`UPDATE equipos_photos SET report_id = ? WHERE id = ?`).bind(id, photoId).run();

  await db
    .prepare(`UPDATE equipos_device SET status = 'alert', updated_at = ? WHERE device_type = ?`)
    .bind(now, deviceType)
    .run();

  await insertEquiposEvent(db, 'alert', {
    deviceType,
    reporterName: name,
    rotation: rot,
    meta: { kind, reportId: id, photoId },
  });
  return { id, photoId };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string} reportId @param {object} input */
export async function equiposAckAlert(db, reportId, input) {
  const { name, rot } = validateIdentity(input.reporterName, input.rotation);
  const row = await db.prepare(`SELECT * FROM equipos_team_reports WHERE id = ?`).bind(reportId).first();
  if (!row || row.active !== 1) {
    throw new EquiposError('alert_missing', 'Reporte no encontrado o ya atendido.');
  }
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE equipos_team_reports SET
        active = 0, acknowledged_at = ?,
        acknowledged_by_name = ?, acknowledged_by_rotation = ?
       WHERE id = ?`
    )
    .bind(now, name, rot, reportId)
    .run();

  const other = await db
    .prepare(`SELECT 1 AS x FROM equipos_team_reports WHERE device_type = ? AND active = 1 LIMIT 1`)
    .bind(row.device_type)
    .first();
  if (!other) {
    const dev = await getEquiposDevice(db, row.device_type);
    const newStatus = dev?.holder_name ? 'in_use' : 'available';
    await db
      .prepare(`UPDATE equipos_device SET status = ?, updated_at = ? WHERE device_type = ?`)
      .bind(newStatus, now, row.device_type)
      .run();
  }

  await insertEquiposEvent(db, 'alert_ack', {
    deviceType: row.device_type,
    reporterName: name,
    rotation: rot,
    meta: { reportId },
  });
  return { ok: true };
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} input */
export async function equiposAdminPurgeQueue(db, input) {
  const targets = resolvePurgeDeviceTypes(input.deviceType || 'all');
  if (!targets.length) throw new EquiposError('invalid_device', 'Dispositivo inv?lido.');

  const now = new Date().toISOString();
  const results = [];

  for (const deviceType of targets) {
    const clearedRes = await db
      .prepare(`DELETE FROM equipos_waitlist WHERE device_type = ?`)
      .bind(deviceType)
      .run();
    const cleared = clearedRes.meta.changes;
    const device = await getEquiposDevice(db, deviceType);
    let hadCustody = false;
    if (device?.status === 'in_use') {
      hadCustody = true;
      const session = await getOpenSessionForDevice(db, deviceType);
      if (session) {
        const checked = Date.parse(session.checked_out_at);
        const duration = Math.max(0, Math.round((Date.now() - checked) / 1000));
        await db
          .prepare(
            `UPDATE equipos_sessions SET returned_at = ?, duration_seconds = ?, closed_reason = 'admin_purge'
             WHERE id = ?`
          )
          .bind(now, duration, session.id)
          .run();
      }
      await db
        .prepare(
          `UPDATE equipos_device SET
            status = 'available',
            previous_holder_name = holder_name,
            previous_holder_rotation = holder_rotation,
            holder_name = NULL, holder_rotation = NULL,
            checked_out_at = NULL, updated_at = ?
           WHERE device_type = ?`
        )
        .bind(now, deviceType)
        .run();
    }
    await insertEquiposEvent(db, 'admin_purge_queue', {
      deviceType,
      reporterName: input.adminName || 'Admin',
      meta: { clearedWaitlistCount: cleared, hadCustody, adminUserId: input.adminUserId || null },
    });
    results.push({ deviceType, cleared, hadCustody });
  }
  return results;
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {object} row */
export async function insertEquiposPhotoRow(db, row) {
  await db
    .prepare(
      `INSERT INTO equipos_photos (id, session_id, report_id, device_type, photo_kind, file_path, captured_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.sessionId || null,
      row.reportId || null,
      row.deviceType,
      row.photoKind,
      row.filePath,
      row.capturedAt
    )
    .run();
}

/** @param {import('@cloudflare/workers-types').D1Database} db @param {string[]} photoIds */
export async function clearEquiposPhotoReferences(db, photoIds) {
  if (!photoIds.length) return;
  const placeholders = photoIds.map(() => '?').join(',');
  await db
    .prepare(
      `UPDATE equipos_sessions SET pickup_photo_id = NULL WHERE pickup_photo_id IN (${placeholders})`
    )
    .bind(...photoIds)
    .run();
  await db
    .prepare(
      `UPDATE equipos_sessions SET return_photo_id = NULL WHERE return_photo_id IN (${placeholders})`
    )
    .bind(...photoIds)
    .run();
  await db
    .prepare(
      `UPDATE equipos_team_reports SET photo_id = NULL WHERE photo_id IN (${placeholders})`
    )
    .bind(...photoIds)
    .run();
  await db
    .prepare(`DELETE FROM equipos_photos WHERE id IN (${placeholders})`)
    .bind(...photoIds)
    .run();
}
