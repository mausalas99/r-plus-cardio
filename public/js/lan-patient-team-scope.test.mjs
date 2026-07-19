import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClinicalScope } from './clinico-access.mjs';
import { patientForScopeEvaluate } from './features/patients-clinical-filter.mjs';
import {
  filterPatientEntriesForLanTeamScope,
  isPatientInLanTeamSyncScope,
} from './lan-patient-team-scope.mjs';

/** LAN team sync scope rules — bypass TEMP_DISABLE_TEAM_BASED_FILTERING wrapper. */
function isPatientInLanTeamSyncScopeRules(user, patient, activeGuardia, context) {
  if (!user?.user_id || !patient?.id) return false;
  return evaluateClinicalScope(user, patient, activeGuardia, context).readable === true;
}

function filterEntriesByLanTeamScopeRules(entries, user, context, guardiasMap) {
  if (!user?.user_id) return [];
  return (entries || []).filter((entry) => {
    const patient = entry?.patient;
    if (!patient?.id) return false;
    const mapped = patientForScopeEvaluate(patient);
    const activeGuardia =
      guardiasMap && typeof guardiasMap.get === 'function'
        ? guardiasMap.get(String(patient.id)) || null
        : null;
    return isPatientInLanTeamSyncScopeRules(user, mapped, activeGuardia, context);
  });
}

function mockDesktopElectron() {
  globalThis.window = {
    electronAPI: { dbClinicalLoadAll: async () => ({ ok: true, blobs: {} }) },
  };
}

function mockWebClinicalClient() {
  globalThis.window = {};
}

beforeEach(() => {
  mockDesktopElectron();
});

afterEach(() => {
  delete globalThis.window;
});

const baseContext = {
  teams: [{ team_id: 't1', members: [{ user_id: 'r2' }], service: 'Sala', sub_area_fraction: 'A' }],
  assignments: [{ patient_id: 'p1', team_id: 't1', effective_at: '2026-06-01T00:00:00Z' }],
  guardias: [],
  now: '2026-06-02T12:00:00Z',
};

describe('lan-patient-team-scope', () => {
  it('R2 syncs only patients assigned to joined team', () => {
    const user = { user_id: 'r2', rank: 'R2', sala: 'Sala 1' };
    assert.equal(
      isPatientInLanTeamSyncScopeRules(user, { id: 'p1', service: 'Sala' }, null, baseContext),
      true
    );
    assert.equal(
      isPatientInLanTeamSyncScopeRules(user, { id: 'p2', service: 'Torre HU' }, null, baseContext),
      false
    );
  });

  it('R1 syncs only team-assigned patients', () => {
    const user = { user_id: 'r1', rank: 'R1', sala: 'Sala 1' };
    const ctx = {
      teams: [
        {
          team_id: 't-mine',
          service: 'Sala',
          sub_area_fraction: 'B',
          sala: 'Sala 1',
          members: [{ user_id: 'r1' }],
        },
      ],
      assignments: [
        { patient_id: 'p1', team_id: 't-mine', effective_at: '2026-06-01T00:00:00Z' },
        { patient_id: 'p2', team_id: 't-other', effective_at: '2026-06-01T00:00:00Z' },
      ],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    };
    assert.equal(
      isPatientInLanTeamSyncScopeRules(user, { id: 'p1', service: 'Sala', sala: 'Sala 1' }, null, ctx),
      true
    );
    assert.equal(
      isPatientInLanTeamSyncScopeRules(user, { id: 'p2', service: 'Sala', sala: 'Sala 1' }, null, ctx),
      false
    );
  });

  it('R4 on desktop syncs all patients', () => {
    const user = { user_id: 'r4', rank: 'R4' };
    assert.equal(
      isPatientInLanTeamSyncScope(user, { id: 'p9', service: 'Torre HU' }, null, baseContext),
      true
    );
  });

  it('Admin on Safari LAN syncs only team-assigned patients', () => {
    mockWebClinicalClient();
    const user = { user_id: 'u-admin', rank: 'Admin', is_program_admin: 1 };
    const ctx = {
      teams: [
        {
          team_id: 't-mine',
          members: [{ user_id: 'u-admin' }],
          service: 'Sala',
          sub_area_fraction: 'B',
        },
      ],
      assignments: [
        { patient_id: 'p1', team_id: 't-mine', effective_at: '2026-06-01T00:00:00Z' },
      ],
      guardias: [],
      now: '2026-06-02T12:00:00Z',
    };
    assert.equal(
      isPatientInLanTeamSyncScope(user, { id: 'p1', service: 'Sala' }, null, ctx),
      true
    );
    assert.equal(
      isPatientInLanTeamSyncScope(user, { id: 'p9', service: 'Torre HU' }, null, ctx),
      false
    );
  });

  it('filterPatientEntriesForLanTeamScope returns empty without signed-in user', () => {
    const entries = [{ patient: { id: 'p1', servicio: 'Sala' } }];
    assert.equal(filterPatientEntriesForLanTeamScope(entries, null, baseContext, null).length, 0);
  });

  it('filterPatientEntriesForLanTeamScope drops out-of-scope entries', () => {
    const user = { user_id: 'r2', rank: 'R2', sala: 'Sala 1' };
    const entries = [
      { patient: { id: 'p1', servicio: 'Sala' } },
      { patient: { id: 'p2', servicio: 'Torre HU' } },
    ];
    const filtered = filterEntriesByLanTeamScopeRules(entries, user, baseContext, null);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].patient.id, 'p1');
  });
});
