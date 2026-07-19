import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openTestDb } from '../db/test-open-db.mjs';
import { equiposCheckout, insertEquiposPhotoRow } from './equipos-actions.mjs';
import { EQUIPOS_PHOTO_RETENTION_DAYS } from './equipos-constants.mjs';
import {
  purgeExpiredEquiposPhotos,
  msUntilNextUtcSixAm,
} from './equipos-photo-purge.mjs';

describe('equipos-photo-purge', () => {
  it('msUntilNextUtcSixAm is positive', () => {
    assert.ok(msUntilNextUtcSixAm() > 0);
  });

  it('keeps photos within retention window even when queue is idle', () => {
    const { db, close } = openTestDb('ab'.repeat(32));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'equipos-photos-'));
    const recentPath = path.join(tmp, 'recent.jpg');
    fs.writeFileSync(recentPath, 'recent');
    insertEquiposPhotoRow(db, {
      id: 'recent-photo',
      deviceType: 'lumify',
      photoKind: 'pickup',
      filePath: recentPath,
      capturedAt: new Date().toISOString(),
    });
    const out = purgeExpiredEquiposPhotos(tmp, () => db);
    assert.equal(out.removed, 0);
    assert.ok(fs.existsSync(recentPath));
    const row = db.prepare(`SELECT id FROM equipos_photos WHERE id = 'recent-photo'`).get();
    assert.ok(row);
    close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('purges photos older than retention and clears admin references', () => {
    const { db, close } = openTestDb('ab'.repeat(32));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'equipos-photos-'));
    const oldMs = Date.now() - (EQUIPOS_PHOTO_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000;
    const oldIso = new Date(oldMs).toISOString();
    const oldPath = path.join(tmp, 'old.jpg');
    fs.writeFileSync(oldPath, 'old');
    insertEquiposPhotoRow(db, {
      id: 'old-photo',
      deviceType: 'ekg',
      photoKind: 'return',
      filePath: oldPath,
      capturedAt: oldIso,
    });
    db.prepare(
      `INSERT INTO equipos_sessions (
        id, device_type, holder_name, holder_rotation, checked_out_at, return_photo_id
      ) VALUES ('sess-1', 'ekg', 'Ana', 'Sala 1', ?, 'old-photo')`
    ).run(oldIso);
    const out = purgeExpiredEquiposPhotos(tmp, () => db, Date.now());
    assert.equal(out.purged, true);
    assert.equal(out.removed, 1);
    assert.equal(fs.existsSync(oldPath), false);
    assert.equal(
      db.prepare(`SELECT id FROM equipos_photos WHERE id = 'old-photo'`).get(),
      undefined
    );
    const sess = db.prepare(`SELECT return_photo_id FROM equipos_sessions WHERE id = 'sess-1'`).get();
    assert.equal(sess.return_photo_id, null);
    close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
