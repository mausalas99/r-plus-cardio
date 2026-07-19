import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lanDirectoryUserMatchesFilters } from './lan-directory-filters.mjs';

describe('lanDirectoryUserMatchesFilters', () => {
  const base = {
    search: 'drmendoza maria cardiologia',
    hasTeam: true,
    sala: 'Cardiología',
    activityTier: 'active',
  };

  it('matches with all filters open', () => {
    assert.equal(
      lanDirectoryUserMatchesFilters(base, {
        query: '',
        status: 'all',
        sala: '',
        activity: 'all',
      }),
      true
    );
  });

  it('filters by search query', () => {
    assert.equal(lanDirectoryUserMatchesFilters(base, { query: 'mendoza' }), true);
    assert.equal(lanDirectoryUserMatchesFilters(base, { query: 'ortopedia' }), false);
  });

  it('filters by team assignment', () => {
    assert.equal(lanDirectoryUserMatchesFilters(base, { status: 'assigned' }), true);
    assert.equal(lanDirectoryUserMatchesFilters(base, { status: 'unassigned' }), false);
  });

  it('filters by sala', () => {
    assert.equal(lanDirectoryUserMatchesFilters(base, { sala: 'Cardiología' }), true);
    assert.equal(lanDirectoryUserMatchesFilters(base, { sala: 'Oncología' }), false);
  });

  it('filters by activity tier', () => {
    assert.equal(lanDirectoryUserMatchesFilters(base, { activity: 'active' }), true);
    assert.equal(lanDirectoryUserMatchesFilters(base, { activity: 'inactive' }), false);
    assert.equal(
      lanDirectoryUserMatchesFilters({ ...base, activityTier: 'stale' }, { activity: 'inactive' }),
      true
    );
  });
});
