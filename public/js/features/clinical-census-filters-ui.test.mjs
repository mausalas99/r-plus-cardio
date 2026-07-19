import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { hasElevatedTeamPrivileges, shouldShowClinicalCensusFilters } from '../clinical-privileges.mjs';
import {
  readCensusFiltersCollapsed,
  writeCensusFiltersCollapsed,
  CLINICAL_CENSUS_FILTERS_COLLAPSED_LS,
  CLINICAL_CENSUS_FILTER_TEAM_LS,
  CENSUS_TEAM_FILTER_ALL,
  resolveActiveTeamFilterId,
  resolveElevatedTeamFilterId,
  readElevatedTeamFilterPreference,
  writeElevatedTeamFilterPreference,
  isTeamIdInCensusCatalog,
  filterTeamsForCensusSala,
  reconcileCensusTeamFilterForSala,
  censusTeamCatalogForFilters,
  resolveCensusTeamFilterId,
} from './clinical-census-filters-ui.mjs';

beforeEach(() => {
  globalThis.__RPC_MOBILE_WEB__ = true;
  globalThis.window = {};
});

afterEach(() => {
  delete globalThis.__RPC_MOBILE_WEB__;
  delete globalThis.window;
});

describe('clinical census filters visibility', () => {
  it('shouldShowClinicalCensusFilters on iPad for any signed-in user', () => {
    assert.equal(shouldShowClinicalCensusFilters({ user_id: 'u1', rank: 'R1' }), true);
    assert.equal(shouldShowClinicalCensusFilters({ user_id: 'u1', rank: 'Admin' }), true);
    assert.equal(shouldShowClinicalCensusFilters(null), false);
  });

  it('elevated only for R4 Admin program admin', () => {
    assert.equal(hasElevatedTeamPrivileges({ rank: 'R4' }), true);
    assert.equal(hasElevatedTeamPrivileges({ rank: 'Admin' }), true);
    assert.equal(hasElevatedTeamPrivileges({ rank: 'R1', is_program_admin: 1 }), true);
    assert.equal(hasElevatedTeamPrivileges({ rank: 'R1' }), false);
    assert.equal(hasElevatedTeamPrivileges({ rank: 'R2' }), false);
    assert.equal(hasElevatedTeamPrivileges({ rank: 'R3' }), false);
  });
});

describe('clinical census team filter', () => {
  const user = { user_id: 'u1', rank: 'R4', sala: 'Sala 1' };
  const teams = [
    { team_id: 't1', name: 'Dra. Gabriela', sala: 'Sala 1', members: [{ user_id: 'u1' }] },
    { team_id: 't2', name: 'Otro equipo', sala: 'Sala 2', members: [{ user_id: 'u1' }] },
  ];

  it('defaults to Todos los equipos when preference not pinned', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    assert.equal(resolveElevatedTeamFilterId(user, teams, storage), '');
  });

  it('single membership defaults to that team', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    const oneTeam = [teams[0]];
    assert.equal(resolveActiveTeamFilterId(user, oneTeam), 't1');
    assert.equal(resolveElevatedTeamFilterId(user, oneTeam, storage), '');
  });

  it('pinned Todos los equipos clears team filter', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    writeElevatedTeamFilterPreference('', storage);
    assert.equal(mem.get(CLINICAL_CENSUS_FILTER_TEAM_LS), CENSUS_TEAM_FILTER_ALL);
    assert.deepEqual(readElevatedTeamFilterPreference(storage), { pinned: true, teamId: '' });
    assert.equal(resolveElevatedTeamFilterId(user, teams, storage), '');
  });

  it('pinned manual team id is respected', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    writeElevatedTeamFilterPreference('t2', storage);
    assert.equal(resolveElevatedTeamFilterId(user, teams, storage), 't2');
  });

  it('catalog check accepts empty or known team id', () => {
    assert.equal(isTeamIdInCensusCatalog('', teams), true);
    assert.equal(isTeamIdInCensusCatalog('t1', teams), true);
    assert.equal(isTeamIdInCensusCatalog('missing', teams), false);
  });

  it('filterTeamsForCensusSala keeps only teams in selected sala', () => {
    assert.equal(filterTeamsForCensusSala(teams, '__all__').length, 2);
    assert.equal(filterTeamsForCensusSala(teams, 'Sala 1').length, 1);
    assert.equal(filterTeamsForCensusSala(teams, 'Sala 1')[0].team_id, 't1');
    assert.equal(filterTeamsForCensusSala(teams, 'Sala 3').length, 0);
  });

  it('reconcileCensusTeamFilterForSala clears team outside sala scope', () => {
    assert.equal(reconcileCensusTeamFilterForSala('t2', filterTeamsForCensusSala(teams, 'Sala 1')), '');
    assert.equal(reconcileCensusTeamFilterForSala('t1', filterTeamsForCensusSala(teams, 'Sala 1')), 't1');
    assert.equal(reconcileCensusTeamFilterForSala('__unassigned__', filterTeamsForCensusSala(teams, 'Sala 1')), '__unassigned__');
  });

  it('censusTeamCatalogForFilters on iPad shows all teams for Admin/R4', () => {
    const catalog = censusTeamCatalogForFilters(user, teams, '__all__');
    assert.equal(catalog.length, 2);
  });

  it('censusTeamCatalogForFilters on iPad limits residents to joined teams', () => {
    const r1 = {
      user_id: 'u9',
      rank: 'R1',
      sala: 'Sala 1',
    };
    const teamsWithMembership = [
      { ...teams[0], members: [{ user_id: 'u9' }] },
      teams[1],
    ];
    const r1Catalog = censusTeamCatalogForFilters(r1, teamsWithMembership, '__all__');
    assert.equal(r1Catalog.length, 1);
    assert.equal(r1Catalog[0].team_id, 't1');
  });

  it('resolveCensusTeamFilterId defaults to Todos equipos for Admin on iPad', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    assert.equal(resolveCensusTeamFilterId(user, teams, '', storage), '');
  });

  it('resolveCensusTeamFilterId defaults to joined team for R1 on iPad', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    const r1 = { user_id: 'u9', rank: 'R1', sala: 'Sala 1' };
    const oneTeam = [{ ...teams[0], members: [{ user_id: 'u9' }] }];
    assert.equal(resolveCensusTeamFilterId(r1, oneTeam, '', storage), 't1');
  });
});

describe('clinical census filters collapse storage', () => {
  it('defaults expanded', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    };
    assert.equal(readCensusFiltersCollapsed(storage), false);
    writeCensusFiltersCollapsed(true, storage);
    assert.equal(mem.get(CLINICAL_CENSUS_FILTERS_COLLAPSED_LS), '1');
    assert.equal(readCensusFiltersCollapsed(storage), true);
    writeCensusFiltersCollapsed(false, storage);
    assert.equal(readCensusFiltersCollapsed(storage), false);
  });
});
