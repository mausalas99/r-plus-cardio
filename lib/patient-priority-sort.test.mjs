import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  comparePatientsByPriorityThenBed,
  patientClinicalPriorityRank,
  sortPatientsByPriorityThenBed,
} from './patient-priority-sort.mjs';
import { comparePatientsByBed } from './patient-bed-sort.mjs';
import { serializePendientesJson } from './entrega/entrega-pendientes.mjs';

describe('patient-bed-sort', () => {
  it('orders by cuarto then cama', () => {
    const rows = [
      { id: 'b', cuarto: '12', cama: '2' },
      { id: 'a', cuarto: '3', cama: '1' },
      { id: 'c', cuarto: '3', cama: '2' },
    ].sort(comparePatientsByBed);
    assert.deepEqual(
      rows.map((r) => r.id),
      ['a', 'c', 'b']
    );
  });
});

describe('patient-priority-sort', () => {
  it('ranks critical and unstable above stable', () => {
    const guardias = new Map([
      [
        's1',
        {
          pendientes_json: serializePendientesJson({
            version: 2,
            handoffContext: { clinicalStatus: 'stable' },
            items: [],
          }),
        },
      ],
      [
        'u1',
        {
          pendientes_json: serializePendientesJson({
            version: 2,
            handoffContext: { clinicalStatus: 'unstable' },
            items: [],
          }),
        },
      ],
      ['c1', { is_critical: 1 }],
    ]);
    assert.equal(patientClinicalPriorityRank({ id: 'c1' }, guardias.get('c1')), 0);
    assert.equal(patientClinicalPriorityRank({ id: 'u1' }, guardias.get('u1')), 1);
    assert.equal(patientClinicalPriorityRank({ id: 's1' }, guardias.get('s1')), 2);
  });

  it('sorts priority tiers then bed', () => {
    const guardias = new Map([
      ['c2', { is_critical: 1 }],
      ['c1', { is_critical: 1 }],
      [
        'u1',
        {
          pendientes_json: serializePendientesJson({
            version: 2,
            handoffContext: { clinicalStatus: 'unstable' },
            items: [],
          }),
        },
      ],
      ['s2', { cuarto: '10', cama: '1' }],
      ['s1', { cuarto: '2', cama: '1' }],
    ]);
    const patients = [
      { id: 's2', cuarto: '10', cama: '1' },
      { id: 'c2', cuarto: '8', cama: '1' },
      { id: 'u1', cuarto: '5', cama: '1' },
      { id: 's1', cuarto: '2', cama: '1' },
      { id: 'c1', cuarto: '3', cama: '1' },
    ];
    const sorted = sortPatientsByPriorityThenBed(patients, guardias);
    assert.deepEqual(
      sorted.map((p) => p.id),
      ['c1', 'c2', 'u1', 's1', 's2']
    );
  });

  it('comparePatientsByPriorityThenBed is stable for equal priority', () => {
    const a = { id: 'a', cuarto: '4', cama: '1' };
    const b = { id: 'b', cuarto: '2', cama: '1' };
    assert.ok(comparePatientsByPriorityThenBed(a, b, new Map()) > 0);
  });
});
