import {
  CURRICULUM_VERSION,
  isValidStepForBranch,
  migrateTourStepId,
} from './onboarding-curriculum.mjs';

export const GUIDED_TOUR_PROGRESS_LS_KEY = 'rpc-guided-tour-progress';

export function loadTourProgress(storage = localStorage) {
  try {
    const raw = storage.getItem(GUIDED_TOUR_PROGRESS_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || !p.stepId || !p.branch) return null;
    const branch =
      p.branch === 'guardia-v7' ? 'guardia-v7'
        : p.branch === 'quick-route' ? 'quick-route'
          : p.branch === 'interconsulta' ? 'interconsulta'
            : 'sala';
    const stepId = migrateTourStepId(p.stepId, branch);
    if (!isValidStepForBranch(stepId, branch, 'base')) return null;
    return { ...p, branch, stepId, mode: 'base' };
  } catch {
    return null;
  }
}

export function saveTourProgress(payload, storage = localStorage) {
  const branch =
    payload.branch === 'guardia-v7' ? 'guardia-v7'
      : payload.branch === 'quick-route' ? 'quick-route'
        : payload.branch === 'interconsulta' ? 'interconsulta'
          : 'sala';
  const body = {
    branch,
    track: payload.track || branch,
    stepId: payload.stepId,
    chapterId: payload.chapterId || null,
    moduleOnly: !!payload.moduleOnly,
    mode: 'base',
    curriculumVersion: CURRICULUM_VERSION,
    updatedAt: Date.now(),
  };
  storage.setItem(GUIDED_TOUR_PROGRESS_LS_KEY, JSON.stringify(body));
}

export function clearTourProgress(storage = localStorage) {
  try {
    storage.removeItem(GUIDED_TOUR_PROGRESS_LS_KEY);
  } catch (_e) { void _e; }
}
