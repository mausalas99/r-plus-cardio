import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../db/test-open-db.mjs';
import {
  equiposCheckout,
  equiposReturn,
  equiposWaitlistJoin,
  equiposWaitlistSkip,
  equiposCreateAlert,
  equiposAckAlert,
  equiposAdminPurgeQueue,
  equiposAdminWipeHistory,
  insertEquiposPhotoRow,
  EquiposError,
  buildEquiposBoard,
  verifyEquiposToken,
  getEquiposProgramAccess,
} from './equipos-db.mjs';

function openEquiposDb() {
  return openTestDb('ab'.repeat(32));
}

describe('equipos-db', () => {
  it('checkout and return with duration', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Ana López',
        rotation: 'Sala 1',
      });
      const board = buildEquiposBoard(db);
      assert.equal(board.devices.find((d) => d.device_type === 'ultrasound').status, 'in_use');
      equiposReturn(db, {
        deviceType: 'ultrasound',
        reporterName: 'Ana López',
        rotation: 'Sala 1',
      });
      const sessions = db.prepare(`SELECT * FROM equipos_sessions`).all();
      assert.equal(sessions.length, 1);
      assert.ok(sessions[0].duration_seconds >= 0);
      assert.equal(sessions[0].closed_reason, 'return');
    } finally {
      close();
    }
  });

  it('lumify return requires chargePct', () => {
    const { db, close } = openEquiposDb();
    try {
      assert.throws(
        () =>
          equiposReturn(db, {
            deviceType: 'lumify',
            reporterName: 'Ana López',
            rotation: 'Sala 1',
          }),
        (e) => e instanceof EquiposError && e.code === 'not_in_use'
      );
      equiposCheckout(db, {
        deviceType: 'lumify',
        reporterName: 'Ana López',
        rotation: 'Sala 1',
        pickupPhotoId: 'photo-1',
      });
      assert.throws(
        () =>
          equiposReturn(db, {
            deviceType: 'lumify',
            reporterName: 'Ana López',
            rotation: 'Sala 1',
            returnPhotoId: 'photo-2',
          }),
        (e) => e instanceof EquiposError && e.code === 'charge_required'
      );
      equiposReturn(db, {
        deviceType: 'lumify',
        reporterName: 'Ana López',
        rotation: 'Sala 1',
        chargePct: 55,
        gelEmpty: false,
        returnPhotoId: 'photo-2',
      });
      const dev = db.prepare(`SELECT charge_pct FROM equipos_device WHERE device_type = 'lumify'`).get();
      assert.equal(dev.charge_pct, 55);
    } finally {
      close();
    }
  });

  it('lumify pickup charge optional', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'lumify',
        reporterName: 'Bob Smith',
        rotation: 'Sala 2',
        pickupPhotoId: 'p1',
      });
      const session = db.prepare(`SELECT lumify_pickup_charge_pct FROM equipos_sessions`).get();
      assert.equal(session.lumify_pickup_charge_pct, null);
    } finally {
      close();
    }
  });

  it('waitlist join when in use', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ekg',
        reporterName: 'Holder',
        rotation: 'Sala 1',
        pickupPhotoId: 'p',
      });
      equiposWaitlistJoin(db, {
        deviceType: 'ekg',
        reporterName: 'Waiter',
        rotation: 'Sala 2',
      });
      const wl = db.prepare(`SELECT COUNT(*) AS c FROM equipos_waitlist`).get().c;
      assert.equal(wl, 1);
    } finally {
      close();
    }
  });

  it('waitlist join when device is available with empty queue', () => {
    const { db, close } = openEquiposDb();
    try {
      const dev = db.prepare(`SELECT status FROM equipos_device WHERE device_type = 'lumify'`).get();
      assert.equal(dev.status, 'available');
      equiposWaitlistJoin(db, {
        deviceType: 'lumify',
        reporterName: 'Reserva',
        rotation: 'Sala 2',
      });
      const row = db
        .prepare(
          `SELECT reporter_name, position FROM equipos_waitlist
           WHERE device_type = 'lumify'`
        )
        .get();
      assert.equal(row.reporter_name, 'Reserva');
      assert.equal(row.position, 1);
      const stillFree = db.prepare(`SELECT status FROM equipos_device WHERE device_type = 'lumify'`).get();
      assert.equal(stillFree.status, 'available');
    } finally {
      close();
    }
  });

  it('waitlist join when device is available with existing queue', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'lumify',
        reporterName: 'Team 1',
        rotation: 'Sala 1',
        pickupPhotoId: 'p1',
      });
      equiposWaitlistJoin(db, {
        deviceType: 'lumify',
        reporterName: 'Team 2',
        rotation: 'Sala 2',
      });
      equiposWaitlistJoin(db, {
        deviceType: 'lumify',
        reporterName: 'Team 3',
        rotation: 'Torre HU',
      });
      equiposReturn(db, {
        deviceType: 'lumify',
        reporterName: 'Team 1',
        rotation: 'Sala 1',
        chargePct: 80,
        gelEmpty: false,
        returnPhotoId: 'p2',
      });
      const before = db.prepare(`SELECT COUNT(*) AS c FROM equipos_waitlist`).get().c;
      assert.equal(before, 2);

      equiposWaitlistJoin(db, {
        deviceType: 'lumify',
        reporterName: 'Team 4',
        rotation: 'Sala E',
      });
      const after = db.prepare(`SELECT COUNT(*) AS c FROM equipos_waitlist`).get().c;
      assert.equal(after, 3);
    } finally {
      close();
    }
  });

  it('checkout bypass preserves waitlist order for next return', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 1',
        rotation: 'Sala 1',
      });
      equiposWaitlistJoin(db, { deviceType: 'ultrasound', reporterName: 'Team 2', rotation: 'Sala 2' });
      equiposWaitlistJoin(db, { deviceType: 'ultrasound', reporterName: 'Team 3', rotation: 'Torre HU' });
      equiposWaitlistJoin(db, { deviceType: 'ultrasound', reporterName: 'Team 4', rotation: 'Sala E' });
      equiposReturn(db, { deviceType: 'ultrasound', reporterName: 'Team 1', rotation: 'Sala 1' });

      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 4',
        rotation: 'Sala E',
        forceQueueBypass: true,
      });
      equiposReturn(db, { deviceType: 'ultrasound', reporterName: 'Team 4', rotation: 'Sala E' });

      const order = db
        .prepare(
          `SELECT reporter_name FROM equipos_waitlist
           WHERE device_type = 'ultrasound' ORDER BY position ASC`
        )
        .all()
        .map((r) => r.reporter_name);
      assert.deepEqual(order, ['Team 2', 'Team 3']);
    } finally {
      close();
    }
  });

  it('waitlist skip defers one slot and preserves rejoin order', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 1',
        rotation: 'Sala 1',
      });
      const join = (name, rot) =>
        equiposWaitlistJoin(db, { deviceType: 'ultrasound', reporterName: name, rotation: rot });
      join('Team 2', 'Sala 2');
      join('Team 3', 'Torre HU');
      join('Team 4', 'Sala E');

      equiposWaitlistSkip(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 2',
        rotation: 'Sala 2',
      });

      let order = db
        .prepare(
          `SELECT reporter_name FROM equipos_waitlist
           WHERE device_type = 'ultrasound' ORDER BY position ASC`
        )
        .all()
        .map((r) => r.reporter_name);
      assert.deepEqual(order, ['Team 3', 'Team 2', 'Team 4']);

      const { nextInQueue } = equiposReturn(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 1',
        rotation: 'Sala 1',
      });
      assert.equal(nextInQueue?.reporter_name, 'Team 3');

      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 3',
        rotation: 'Torre HU',
      });
      const afterTeam3 = equiposReturn(db, {
        deviceType: 'ultrasound',
        reporterName: 'Team 3',
        rotation: 'Torre HU',
      });
      assert.equal(afterTeam3.nextInQueue?.reporter_name, 'Team 2');

      order = db
        .prepare(
          `SELECT reporter_name FROM equipos_waitlist
           WHERE device_type = 'ultrasound' ORDER BY position ASC`
        )
        .all()
        .map((r) => r.reporter_name);
      assert.deepEqual(order, ['Team 2', 'Team 4']);
    } finally {
      close();
    }
  });

  it('waitlist skip rejects last in queue', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ekg',
        reporterName: 'Holder',
        rotation: 'Sala 1',
        pickupPhotoId: 'p',
      });
      equiposWaitlistJoin(db, {
        deviceType: 'ekg',
        reporterName: 'Only',
        rotation: 'Sala 2',
      });
      assert.throws(
        () =>
          equiposWaitlistSkip(db, {
            deviceType: 'ekg',
            reporterName: 'Only',
            rotation: 'Sala 2',
          }),
        (e) => e instanceof EquiposError && e.code === 'cannot_skip'
      );
    } finally {
      close();
    }
  });

  it('alert and ack', () => {
    const { db, close } = openEquiposDb();
    try {
      const photoId = 'photo-alert-1';
      insertEquiposPhotoRow(db, {
        id: photoId,
        deviceType: 'ekg',
        photoKind: 'alert',
        filePath: '/tmp/alert.jpg',
        capturedAt: new Date().toISOString(),
      });
      const { id } = equiposCreateAlert(db, {
        deviceType: 'ekg',
        kind: 'malfunction',
        reporterName: 'Rep',
        rotation: 'Torre HU',
        message: 'Cable roto',
        photoId,
      });
      const report = db.prepare(`SELECT photo_id FROM equipos_team_reports WHERE id = ?`).get(id);
      assert.equal(report.photo_id, photoId);
      const linked = db.prepare(`SELECT report_id FROM equipos_photos WHERE id = ?`).get(photoId);
      assert.equal(linked.report_id, id);
      equiposAckAlert(db, id, { reporterName: 'Admin', rotation: 'Sala E' });
      const active = db.prepare(`SELECT COUNT(*) AS c FROM equipos_team_reports WHERE active = 1`).get().c;
      assert.equal(active, 0);
    } finally {
      close();
    }
  });

  it('alert requires photo', () => {
    const { db, close } = openEquiposDb();
    try {
      assert.throws(
        () =>
          equiposCreateAlert(db, {
            deviceType: 'ekg',
            kind: 'malfunction',
            reporterName: 'Rep',
            rotation: 'Torre HU',
          }),
        (e) => e instanceof EquiposError && e.code === 'photo_required'
      );
    } finally {
      close();
    }
  });

  it('admin purge clears waitlist and custody', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Xavier López',
        rotation: 'Sala 1',
      });
      equiposWaitlistJoin(db, {
        deviceType: 'ultrasound',
        reporterName: 'Yolanda Pérez',
        rotation: 'Sala 2',
      });
      const results = equiposAdminPurgeQueue(db, {
        deviceType: 'ultrasound',
        adminName: 'R4',
      });
      assert.equal(results[0].hadCustody, true);
      assert.ok(results[0].cleared >= 1);
      const dev = db.prepare(`SELECT status FROM equipos_device WHERE device_type = 'ultrasound'`).get();
      assert.equal(dev.status, 'available');
    } finally {
      close();
    }
  });

  it('admin wipe history clears sessions reports events and photos', () => {
    const { db, close } = openEquiposDb();
    try {
      equiposCheckout(db, {
        deviceType: 'ultrasound',
        reporterName: 'Ana López',
        rotation: 'Sala 1',
      });
      equiposReturn(db, {
        deviceType: 'ultrasound',
        reporterName: 'Ana López',
        rotation: 'Sala 1',
      });
      const devBefore = db
        .prepare(`SELECT previous_holder_name FROM equipos_device WHERE device_type = 'ultrasound'`)
        .get();
      assert.ok(devBefore.previous_holder_name);
      insertEquiposPhotoRow(db, {
        id: 'photo-wipe-1',
        deviceType: 'ultrasound',
        photoKind: 'pickup',
        filePath: '/tmp/photo-wipe-1.jpg',
        capturedAt: new Date().toISOString(),
      });
      const out = equiposAdminWipeHistory(db, { adminName: 'R4' });
      assert.equal(out.sessions, 1);
      assert.equal(out.reports, 0);
      assert.ok(out.events >= 1);
      assert.equal(out.photos, 1);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM equipos_sessions`).get().n, 0);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM equipos_team_reports`).get().n, 0);
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM equipos_photos`).get().n, 0);
      const devAfter = db
        .prepare(`SELECT previous_holder_name FROM equipos_device WHERE device_type = 'ultrasound'`)
        .get();
      assert.equal(devAfter.previous_holder_name, null);
      const events = db.prepare(`SELECT event_type FROM equipos_events`).all();
      assert.equal(events.length, 1);
      assert.equal(events[0].event_type, 'admin_wipe_history');
    } finally {
      close();
    }
  });

  it('verifyEquiposToken', () => {
    const { db, close } = openEquiposDb();
    try {
      const row = getEquiposProgramAccess(db);
      assert.ok(verifyEquiposToken(db, row.access_token));
      assert.equal(verifyEquiposToken(db, 'bad'), false);
    } finally {
      close();
    }
  });
});
