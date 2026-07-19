import { shouldEnforceTeamPatientMirror } from '../clinical-privileges.mjs';
import { indicaciones, labHistory, notes, patients, setPatients } from '../app-state.mjs';
import { filterPatientsForClinicalSidebar } from '../features/patients-clinical-filter.mjs';
import { clinicalSessionContext } from '../clinical-session-context.mjs';
import { isClinicalScopeReadyForLanPatientApply } from './scope-lan.mjs';
import { getClinicalScopeContextForEvaluate } from './scope-evaluate.mjs';

function dropPatientSidecars(pid) {
  const id = String(pid || '');
  if (!id) return;
  if (notes[id]) delete notes[id];
  if (indicaciones[id]) delete indicaciones[id];
  if (labHistory[id]) delete labHistory[id];
}

/** Replace in-memory census with team-scoped rows only (web/iPad). */
export function pruneMobilePatientsOutsideTeamScope() {
  if (!shouldEnforceTeamPatientMirror()) return 0;
  const user = clinicalSessionContext.user;
  if (!user?.user_id) return 0;
  if (!isClinicalScopeReadyForLanPatientApply()) {
    // Scope still hydrating from LAN clinicalOps — keep local census until ready.
    return 0;
  }
  const ctx = getClinicalScopeContextForEvaluate();
  const visible = filterPatientsForClinicalSidebar(
    patients,
    user,
    ctx,
    clinicalSessionContext.guardiasMap
  );
  const visibleIds = new Set(visible.map((p) => String(p?.id || '')).filter(Boolean));
  const removed = Math.max(0, patients.length - visible.length);
  for (const pid of Object.keys(notes)) {
    if (!visibleIds.has(pid)) dropPatientSidecars(pid);
  }
  for (const p of patients) {
    const pid = String(p?.id || '');
    if (pid && !visibleIds.has(pid)) dropPatientSidecars(pid);
  }
  setPatients(visible);
  return removed;
}

/** Prune + one sidebar refresh after LAN scope/patients settle (avoids 3↔11 flash). */
export async function finalizeMobileLanPatientCensus() {
  if (!shouldEnforceTeamPatientMirror()) return { pruned: 0 };
  const pruned = pruneMobilePatientsOutsideTeamScope();
  if (typeof document === 'undefined') return { pruned };
  try {
    const mod = await import('../features/patients.mjs');
    if (typeof mod.invalidateMobileSidebarPatientCache === 'function') {
      mod.invalidateMobileSidebarPatientCache();
    }
    if (typeof mod.ensureActivePatientInSidebarScope === 'function') {
      mod.ensureActivePatientInSidebarScope();
    }
    if (typeof mod.renderPatientList === 'function') {
      mod.renderPatientList({ silent: true });
    }
  } catch { /* patients UI optional */ }
  return { pruned };
}
