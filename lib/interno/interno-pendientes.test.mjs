import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3-multiple-ciphers';
import { applyMigrations } from '../db/schema.mjs';
import {
  createProcedimientoItem,
  serializePendientesJson,
} from '../entrega/entrega-pendientes.mjs';
import { defaultHandoffContext } from '../entrega/entrega-handoff-context.mjs';
import {
  ensureClinicalUser,
  upsertActiveGuardia,
  createTeam,
} from '../db/clinical-access-db.mjs';
import { patchGuardiaPendienteComplete } from './interno-pendientes.mjs';
import {
  parsePendientesJson,
  buildInternoBoardDto,
} from './interno-board.mjs';

describe('parsePendientesJson v2', () => {
  it('maps procedimiento with badges and time', () => {
    const item = createProcedimientoItem({
      label: 'Endoscopia',
      kind: 'otro',
      scheduledAt: '2026-06-02T14:00:00',
      requires: { consentimiento: true },
      autorizado: false,
    });
    const raw = serializePendientesJson({ version: 2, items: [item] });
    const rows = parsePendientesJson(raw);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, item.id);
    assert.equal(rows[0].label, 'Endoscopia');
    assert.equal(rows[0].kind, 'otro');
    assert.equal(rows[0].time, '14:00');
    assert.deepEqual(rows[0].badges, ['consentimiento']);
    assert.equal(rows[0].completed, false);
  });

  it('legacy string array extracts time into label', () => {
    const rows = parsePendientesJson(JSON.stringify(['Endoscopia HOY 14:00', 'Hb mañana']));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].label, 'Endoscopia HOY 14:00');
    assert.equal(rows[0].time, '14:00');
    assert.deepEqual(rows[0].badges, []);
    assert.equal(rows[0].completed, false);
  });
});

describe('buildInternoBoardDto handoff markers', () => {
  it('exposes signedRefusal and show from handoffContext', () => {
    const handoff = defaultHandoffContext();
    handoff.signedRefusal = true;
    handoff.show = true;
    const json = serializePendientesJson({
      version: 2,
      handoffContext: handoff,
      vitalsPlan: { mode: 'interval', frequency: '4h', metrics: ['ta'] },
      items: [],
    });
    const guardias = new Map([['p1', { pendientes_json: json }]]);
    const dto = buildInternoBoardDto('Sala 1', [{ id: 'p1', nombre: 'Test' }], guardias);
    assert.equal(dto.patients[0].signedRefusal, true);
    assert.equal(dto.patients[0].show, true);
  });

  it('exposes isCritical from guardia row', () => {
    const json = serializePendientesJson({
      version: 2,
      vitalsPlan: { mode: 'interval', frequency: '4h', metrics: ['ta'] },
      items: [],
    });
    const guardias = new Map([
      [
        'p1',
        {
          pendientes_json: json,
          is_critical: 1,
        },
      ],
    ]);
    const dto = buildInternoBoardDto('Sala 1', [{ id: 'p1', nombre: 'Test' }], guardias);
    assert.equal(dto.patients[0].isCritical, true);
  });
});

describe('buildInternoBoardDto pendingCount', () => {
  it('counts only non-completed procedimientos and legacy_text', () => {
    const active = createProcedimientoItem({ label: 'TAC', kind: 'imagen' });
    const done = createProcedimientoItem({ label: 'Hb', kind: 'otro' });
    done.completedAt = new Date().toISOString();
    const json = serializePendientesJson({ version: 2, items: [active, done] });
    const guardias = new Map([
      [
        'p1',
        {
          pendientes_json: json,
          vitals_frequency: 'None',
        },
      ],
    ]);
    const dto = buildInternoBoardDto('Sala 1', [{ id: 'p1', nombre: 'García López Ana' }], guardias);
    assert.equal(dto.patients[0].pendingCount, 1);
    assert.equal(dto.patients[0].pendientes.length, 2);
  });
});

describe('patchGuardiaPendienteComplete', () => {
  /** @type {import('better-sqlite3').Database} */
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    applyMigrations(db);
  });

  it('completes item on active guardia', () => {
    const u = ensureClinicalUser(db, { clientId: 'r1-patch', rank: 'R1' });
    const team = createTeam(db, {
      name: 'A1',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: u.userId,
    });
    const item = createProcedimientoItem({ label: 'TAC', kind: 'imagen' });
    upsertActiveGuardia(db, {
      patientId: 'p-patch',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
      pendientesJson: serializePendientesJson({ version: 2, items: [item] }),
    });

    const out = patchGuardiaPendienteComplete(db, 'p-patch', item.id, {
      kind: 'interno',
      name: 'Ana',
    });
    assert.equal(out.ok, true);
    assert.ok(out.item.completedAt);
    assert.equal(out.item.completedBy.name, 'Ana');
  });

  it('returns guardia_not_found when no active guardia', () => {
    const out = patchGuardiaPendienteComplete(db, 'missing', 'item-1', {
      kind: 'interno',
    });
    assert.equal(out.ok, false);
    assert.equal(out.error, 'guardia_not_found');
  });

  it('returns item_not_found for unknown item id', () => {
    const u = ensureClinicalUser(db, { clientId: 'r1-miss', rank: 'R1' });
    const team = createTeam(db, {
      name: 'A1',
      service: 'Sala',
      onCallDayIndex: 0,
      createdBy: u.userId,
    });
    upsertActiveGuardia(db, {
      patientId: 'p-miss',
      coveringUserId: u.userId,
      sourceTeamId: team.team_id,
      pendientesJson: '[]',
    });
    const out = patchGuardiaPendienteComplete(db, 'p-miss', 'bad-id', { kind: 'interno' });
    assert.equal(out.ok, false);
    assert.equal(out.error, 'item_not_found');
  });
});
