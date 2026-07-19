import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { serializePendientesJson } from '../entrega/entrega-pendientes.mjs';
import {
  isGuardiaCoveringEligibleForInterno,
  resolveInternoBoardPatients,
  filterInternoScopePatients,
} from './interno-scope.mjs';

const scope = {
  teams: [
    {
      team_id: 't1',
      service: 'Sala',
      sala: 'Sala 1',
      sub_area_fraction: 'A1',
      members: [
        { user_id: 'r1-on', rank: 'R1' },
        { user_id: 'r1-other', rank: 'R1' },
      ],
    },
  ],
  salaGuardiaToday: [{ team_id: 't1', user_id: 'r1-on' }],
};

describe('resolveInternoBoardPatients', () => {
  it('includes guardia when patient missing from host store', () => {
    const guardias = [
      {
        patient_id: 'p1',
        covering_user_id: 'r1-on',
        source_team_id: 't1',
        status: 'Active',
        pendientes_json: '{"version":2,"items":[]}',
      },
    ];
    const rows = resolveInternoBoardPatients([], guardias, 'Sala 1', scope);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'p1');
  });

  it('accepts covering R1 assigned in entrega even if not on-call in host snapshot', () => {
    const guardias = [
      {
        patient_id: 'p1',
        covering_user_id: 'r1-other',
        source_team_id: 't1',
        status: 'Active',
      },
    ];
    const rows = resolveInternoBoardPatients(
      [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
      guardias,
      'Sala 1',
      scope
    );
    assert.equal(rows.length, 1);
    assert.equal(
      isGuardiaCoveringEligibleForInterno('r1-other', scope, 'Sala 1'),
      true
    );
  });

  it('uses patientCensus from entrega when host store row is missing', () => {
    const pendientesJson = serializePendientesJson({
      version: 2,
      patientCensus: {
        nombre: 'GONZALEZ DOMINGUEZ GERMAN',
        cuarto: '215',
        cama: '03',
        sala: 'Sala 2',
      },
      items: [],
    });
    const guardias = [
      {
        patient_id: 'p1',
        covering_user_id: 'r1-on',
        source_team_id: 't1',
        status: 'Active',
        pendientes_json: pendientesJson,
      },
    ];
    const rows = resolveInternoBoardPatients([], guardias, 'Sala 1', scope);
    assert.equal(rows.length, 0);
    const scopeS2 = {
      ...scope,
      teams: [{ ...scope.teams[0], sala: 'Sala 2' }],
      salaGuardiaToday: [{ team_id: 't1', user_id: 'r1-on' }],
    };
    const rowsS2 = resolveInternoBoardPatients([], guardias, 'Sala 2', scopeS2);
    assert.equal(rowsS2.length, 1);
    assert.equal(rowsS2[0].nombre, 'GONZALEZ DOMINGUEZ GERMAN');
    assert.equal(rowsS2[0].cuarto, '215');
    assert.equal(rowsS2[0].cama, '03');
  });

  it('excludes guardia when patient is not in census set', () => {
    const guardias = [
      {
        patient_id: 'orphan',
        covering_user_id: 'r1-on',
        source_team_id: 't1',
        status: 'Active',
      },
      {
        patient_id: 'p1',
        covering_user_id: 'r1-on',
        source_team_id: 't1',
        status: 'Active',
      },
    ];
    const rows = resolveInternoBoardPatients(
      [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1', sala: 'Sala 1' }],
      guardias,
      'Sala 1',
      scope,
      { censusPatientIds: new Set(['p1']) }
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'p1');
  });

  it('legacy filter excludes when covering not in on-call set', () => {
    const guardias = [
      {
        patient_id: 'p1',
        covering_user_id: 'r1-other',
        source_team_id: 't1',
        status: 'Active',
      },
    ];
    const legacy = filterInternoScopePatients(
      [{ id: 'p1', nombre: 'Test', servicio: 'Sala', area: 'A1' }],
      guardias,
      'Sala 1',
      ['r1-on']
    );
    assert.equal(legacy.length, 0);
  });
});
