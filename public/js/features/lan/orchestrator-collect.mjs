/** LAN LiveSync local merge source collectors (IM-11). */
import { storage } from '../../storage.js';
import { liveSyncDeletePatchesFromEntityMap } from '../../live-sync-room.mjs';
import { getCachedClinicalOpsSnapshot } from '../../clinical-ops-lan.mjs';
import {
  getClinicalScopeContextForEvaluate,
  isClinicalScopeReadyForLanPatientApply,
} from '../../clinical-access-runtime.mjs';
import { clinicalSessionContext } from '../../clinical-session-context.mjs';
import { filterPatientEntriesForLanTeamScope } from '../../lan-patient-team-scope.mjs';
import { patients } from '../../app-state.mjs';
import { readLiveSyncEntityMap } from './entity-versions.mjs';
import { getLanRuntime } from './orchestrator-runtime.mjs';

export function collectPatientIdsForLiveSync() {
  return patients
    .filter(function (p) {
      return p && p.id && String(p.id).indexOf('demo-') !== 0;
    })
    .map(function (p) {
      return String(p.id);
    });
}

export function collectTodosMapForLiveSync() {
  var out = {};
  collectPatientIdsForLiveSync().forEach(function (pid) {
    var list = storage.getTodos(pid);
    if (list.length) out[pid] = list;
  });
  return out;
}

export function collectPatientEntriesForLanSync() {
  var runtime = getLanRuntime();
  var out = [];
  patients.forEach(function (p) {
    if (!p || !p.id || String(p.id).indexOf('demo-') === 0) return;
    var entry = runtime.buildPatientEntry(p.id);
    if (entry) out.push(entry);
  });
  if (!isClinicalScopeReadyForLanPatientApply()) return [];
  var user = clinicalSessionContext.user;
  if (!user?.user_id) return [];
  return filterPatientEntriesForLanTeamScope(
    out,
    user,
    getClinicalScopeContextForEvaluate(),
    clinicalSessionContext.guardiasMap
  );
}

export function buildLiveSyncLocalMergeSource() {
  return {
    agenda: storage.getScheduledProcedures(),
    todos: collectTodosMapForLiveSync(),
    entries: collectPatientEntriesForLanSync(),
    clinicalOps: getCachedClinicalOpsSnapshot(),
    patches: liveSyncDeletePatchesFromEntityMap(readLiveSyncEntityMap()),
  };
}
