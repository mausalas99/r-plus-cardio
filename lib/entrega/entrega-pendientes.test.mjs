import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePendientesJson,
  serializePendientesJson,
  listActiveProcedimientos,
  pendingRequirementBadges,
  canDeletePendienteItem,
  completePendienteItem,
  createProcedimientoItem,
} from './entrega-pendientes.mjs';

describe('normalizePendientesJson', () => {
  it('legacy string array', () => {
    const doc = normalizePendientesJson(JSON.stringify(['TAC 14:00', 'Hb']));
    assert.equal(doc.version, 2);
    assert.equal(doc.items.length, 2);
    assert.equal(doc.items[0].type, 'legacy_text');
  });

  it('v2 round-trip', () => {
    const raw = serializePendientesJson({
      version: 2,
      items: [
        createProcedimientoItem({
          label: 'Endoscopia',
          kind: 'otro',
          scheduledAt: '2026-06-02T14:00:00',
          lockedBase: true,
          createdBy: { userId: 'u1', rank: 'R1' },
        }),
      ],
    });
    const doc = normalizePendientesJson(raw);
    assert.equal(doc.items[0].type, 'procedimiento');
    assert.equal(doc.items[0].label, 'Endoscopia');
  });
});

describe('pendingRequirementBadges', () => {
  it('consentimiento until autorizado', () => {
    const item = {
      requires: { consentimiento: true, anestesia: false, familiar: false },
      autorizado: false,
      comentado: false,
      agendado: false,
    };
    assert.deepEqual(pendingRequirementBadges(item), ['consentimiento']);
    item.autorizado = true;
    assert.deepEqual(pendingRequirementBadges(item), []);
  });
});

describe('canDeletePendienteItem', () => {
  it('guardia cannot delete lockedBase', () => {
    assert.equal(
      canDeletePendienteItem({ lockedBase: true }, { role: 'guardia' }),
      false
    );
    assert.equal(
      canDeletePendienteItem({ lockedBase: false }, { role: 'guardia' }),
      true
    );
  });

  it('diurno can delete any item', () => {
    assert.equal(canDeletePendienteItem({ lockedBase: true }, { role: 'diurno' }), true);
  });
});

describe('completePendienteItem', () => {
  it('sets completedAt idempotently', () => {
    const doc = normalizePendientesJson('[]');
    const item = createProcedimientoItem({ label: 'TAC', kind: 'imagen' });
    doc.items.push(item);
    const next = completePendienteItem(doc, item.id, {
      kind: 'interno',
      name: 'Ana',
    });
    assert.ok(next.items[0].completedAt);
    const again = completePendienteItem(next, item.id, { kind: 'interno' });
    assert.equal(again.items[0].completedAt, next.items[0].completedAt);
  });
});

describe('listActiveProcedimientos', () => {
  it('excludes completed', () => {
    const item = createProcedimientoItem({ label: 'X', kind: 'otro' });
    item.completedAt = new Date().toISOString();
    const doc = { version: 2, items: [item] };
    assert.equal(listActiveProcedimientos(doc).length, 0);
  });
});
