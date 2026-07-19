/** LAN directorio mutable runtime state. */
export const lanDirRt = {
  teams: [],
  collapsedRanks: new Set(),
  expandedRanks: new Set(),
  lastFingerprint: '',
  lanPullLastAt: 0,
  ipcLastAt: 0,
  freezeAutoRefresh: false,
  filterQuery: '',
  filterStatus: 'all',
  filterSala: '',
  filterActivity: 'all',
};

export const LAN_DIRECTORY_RANK_AUTO_COLLAPSE_THRESHOLD = 4;
export const LAN_DIRECTORY_LAN_PULL_MIN_MS = 30_000;
export const LAN_DIRECTORY_IPC_MIN_MS = 4_000;

export const LAN_DIRECTORY_FILTER_SELECT_IDS = new Set([
  'clinical-lan-directory-status-filter',
  'clinical-lan-directory-sala-filter',
  'clinical-lan-directory-activity-filter',
]);

export const LAN_USER_RANK_ORDER = ['R1', 'R2', 'R3', 'R4', 'Admin'];
