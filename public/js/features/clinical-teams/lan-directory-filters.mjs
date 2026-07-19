/**
 * @param {{ search?: string, hasTeam?: boolean, sala?: string, activityTier?: string }} meta
 * @param {{ query?: string, status?: string, sala?: string, activity?: string }} filters
 */
function matchesQueryFilter(meta, filters) {
  const q = String(filters.query || '').trim().toLowerCase();
  return !q || String(meta.search || '').includes(q);
}

function matchesActivityFilter(meta, filters) {
  const activity = filters.activity || 'all';
  if (activity === 'active' && meta.activityTier !== 'active') return false;
  if (activity === 'inactive' && meta.activityTier === 'active') return false;
  return true;
}

function matchesStatusFilter(meta, filters) {
  const status = filters.status || 'all';
  if (status === 'unassigned' && meta.hasTeam) return false;
  if (status === 'assigned' && !meta.hasTeam) return false;
  return true;
}

function matchesSalaFilter(meta, filters) {
  const sala = String(filters.sala || '').trim();
  return !sala || String(meta.sala || '').trim() === sala;
}

/**
 * @param {{ search?: string, hasTeam?: boolean, sala?: string, activityTier?: string }} meta
 * @param {{ query?: string, status?: string, sala?: string, activity?: string }} filters
 */
export function lanDirectoryUserMatchesFilters(meta, filters) {
  return (
    matchesQueryFilter(meta, filters) &&
    matchesActivityFilter(meta, filters) &&
    matchesStatusFilter(meta, filters) &&
    matchesSalaFilter(meta, filters)
  );
}
