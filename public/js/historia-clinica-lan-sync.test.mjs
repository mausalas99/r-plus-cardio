import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import { markHistoriaPendingLanSync, buildHistoriaClinicaDelta } from './historia-clinica-lan-sync.mjs';

describe('markHistoriaPendingLanSync', () => {
  it('stores pending flags and replay metadata on patient', () => {
    const patient = {
      id: 'p1',
      historiaClinica: { version: 2, data: { motivoConsulta: 'dolor' } },
    };
    markHistoriaPendingLanSync(patient, {
      expectedVersion: 1,
      baseData: { motivoConsulta: '' },
      changedKeys: ['motivoConsulta', 'padecimientoActual'],
      source: 'drive-import',
    });
    assert.equal(patient.historiaClinica.pendingLanSync, true);
    assert.deepEqual(patient.historiaClinica.lanSyncPending.changedKeys, [
      'motivoConsulta',
      'padecimientoActual',
    ]);
    assert.equal(patient.historiaClinica.lanSyncPending.expectedVersion, 1);
    assert.equal(patient.historiaClinica.lanSyncPending.source, 'drive-import');
  });
});

test('buildHistoriaClinicaDelta emits safe pathValues for v1 paths', () => {
  const patient = {
    id: 'pat_1',
    historiaClinica: {
      version: 42,
      data: {
        labsAtAdmission: { na: 140 },
        plan: 'Hidratación IV',
      },
    },
  };
  const delta = buildHistoriaClinicaDelta(patient, {
    changedPaths: ['labsAtAdmission.na', 'plan'],
    clientId: 'lc_a',
    roomId: 'room-a',
    nowMs: () => 1718293049283,
  });

  assert.equal(delta.entityType, 'historiaClinica');
  assert.equal(delta.entityId, 'pat_1');
  assert.equal(delta.expectedVersion, 42);
  assert.equal(delta.pathValues['labsAtAdmission.na'], 140);
  assert.equal(delta.pathValues.plan, 'Hidratación IV');
  assert.equal(delta.pathMeta['labsAtAdmission.na'].clientTimestamp, 1718293049283);
});

test('buildHistoriaClinicaDelta returns null for unsafe array index paths', () => {
  const patient = { id: 'pat_1', historiaClinica: { version: 1, data: { plan: [{ text: 'x' }] } } };
  assert.equal(
    buildHistoriaClinicaDelta(patient, {
      changedPaths: ['plan.0.text'],
      clientId: 'lc_a',
      roomId: 'room-a',
      nowMs: () => 1,
    }),
    null
  );
});
