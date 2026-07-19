import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../db/test-open-db.mjs';
import { mergeEquiposStateFromSnapshot } from './equipos-host-merge.mjs';

describe('equipos-host-merge', () => {
  it('merges newer device state', () => {
    const { db, close } = openTestDb('ab'.repeat(32));
    const newer = new Date(Date.now() + 60000).toISOString();
    const out = mergeEquiposStateFromSnapshot(db, {
      devices: [
        {
          device_type: 'lumify',
          status: 'in_use',
          holder_name: 'Temp',
          holder_rotation: 'Sala 1',
          previous_holder_name: null,
          previous_holder_rotation: null,
          checked_out_at: newer,
          charge_pct: null,
          gel_empty: null,
          updated_at: newer,
        },
      ],
      waitlist: [],
    });
    assert.equal(out.merged, 1);
    const row = db.prepare(`SELECT holder_name FROM equipos_device WHERE device_type = 'lumify'`).get();
    assert.equal(row.holder_name, 'Temp');
    close();
  });
});
