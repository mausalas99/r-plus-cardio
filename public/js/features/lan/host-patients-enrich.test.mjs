import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClinicalOpsLookups,
  enrichLanHostPatientRows,
  formatClinicalUserLabel,
  resolvePatientRegistrarLabel,
  resolvePatientTeamLabel,
  resolveUserIdFromLanClientId,
} from './host-patients-enrich.mjs';

describe('host-patients-enrich', () => {
  const clinicalOps = {
    clinical_users: [
      {
        user_id: 'u1',
        username: 'drlopez',
        clinical_name: 'López García',
        rank: 'R2',
      },
    ],
    teams: [
      {
        team_id: 't1',
        name: 'Equipo A',
        service: 'Medicina',
        sub_area_fraction: 'D2',
        created_by: 'u1',
        leader_user_id: 'u1',
      },
    ],
    patient_team_assignment: [
      {
        patient_id: 'p1',
        team_id: 't1',
        effective_at: '2026-06-01T00:00:00.000Z',
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ],
    active_guardias: [
      {
        patient_id: 'p2',
        covering_user_id: 'u1',
        source_team_id: 't1',
        status: 'Active',
      },
    ],
    team_guardia_today: [],
  };

  it('formats clinical user labels', () => {
    assert.equal(
      formatClinicalUserLabel({ rank: 'R2', clinical_name: 'López', username: 'drlopez' }),
      'R2 López · @drlopez'
    );
  });

  it('resolves team label from assignment', () => {
    const lookups = buildClinicalOpsLookups(clinicalOps);
    assert.equal(
      resolvePatientTeamLabel({ id: 'p1' }, lookups),
      'Equipo A · Medicina · D2'
    );
  });

  it('prefers explicit registeredByUserId', () => {
    const lookups = buildClinicalOpsLookups(clinicalOps);
    assert.equal(
      resolvePatientRegistrarLabel(
        { id: 'p9', registeredByUserId: 'u1', audit_log: [] },
        lookups,
        {}
      ),
      'R2 López García · @drlopez'
    );
  });

  it('prefers active guardia covering user as registrar', () => {
    const lookups = buildClinicalOpsLookups(clinicalOps);
    assert.equal(
      resolvePatientRegistrarLabel({ id: 'p2', audit_log: [] }, lookups, {}),
      'R2 López García · @drlopez'
    );
  });

  it('maps audit_log clientId to clinical user via legacy machine username', () => {
    const ops = {
      ...clinicalOps,
      clinical_users: [
        ...clinicalOps.clinical_users,
        {
          user_id: 'u9',
          username: 'lc_mac_interconsultas',
          clinical_name: 'Dr. Inter',
          rank: 'R1',
        },
      ],
    };
    const lookups = buildClinicalOpsLookups(ops);
    assert.equal(resolveUserIdFromLanClientId('lc_mac_interconsultas', lookups), 'u9');
    assert.equal(
      resolvePatientRegistrarLabel(
        {
          id: 'p9',
          audit_log: [{ action: 'patient.create', clientId: 'lc_mac_interconsultas' }],
        },
        lookups,
        {}
      ),
      'R1 Dr. Inter · @lc_mac_interconsultas'
    );
  });

  it('enriches annotated rows with team and timestamps', () => {
    const out = enrichLanHostPatientRows(
      [
        {
          row: { id: 'p1', nombre: 'PAC', updatedAt: '2026-06-10T12:00:00.000Z' },
          local: null,
          status: 'ghost',
        },
      ],
      clinicalOps,
      {}
    );
    assert.equal(out[0].teamLabel, 'Equipo A · Medicina · D2');
    assert.equal(out[0].status, 'ghost');
    assert.ok(out[0].updatedAtMs > 0);
  });
});
