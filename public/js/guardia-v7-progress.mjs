import { GUARDIA_V7_CHAPTERS } from './onboarding-curriculum.mjs';

export const GUARDIA_V7_PROGRESS_LS_KEY = 'rpc-guardia-v7-progress';

/** @returns {{ completedChapters: string[], dismissedCard: boolean, updatedAt: number|null }} */
export function loadGuardiaV7Progress(storage = localStorage) {
  try {
    const raw = storage.getItem(GUARDIA_V7_PROGRESS_LS_KEY);
    if (!raw) return { completedChapters: [], dismissedCard: false, updatedAt: null };
    const p = JSON.parse(raw);
    return {
      completedChapters: Array.isArray(p.completedChapters) ? p.completedChapters : [],
      dismissedCard: !!p.dismissedCard,
      updatedAt: p.updatedAt || null,
    };
  } catch {
    return { completedChapters: [], dismissedCard: false, updatedAt: null };
  }
}

export function saveGuardiaV7Progress(patch, storage = localStorage) {
  const prev = loadGuardiaV7Progress(storage);
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  storage.setItem(GUARDIA_V7_PROGRESS_LS_KEY, JSON.stringify(next));
  return next;
}

export function isGuardiaV7TrackComplete(storage = localStorage) {
  const { completedChapters } = loadGuardiaV7Progress(storage);
  return GUARDIA_V7_CHAPTERS.every((ch) => completedChapters.includes(ch.id));
}

/** @returns {{ completed: number, total: number, percent: number }} */
export function guardiaV7ProgressSummary(storage = localStorage) {
  const total = GUARDIA_V7_CHAPTERS.length;
  const { completedChapters } = loadGuardiaV7Progress(storage);
  const completed = GUARDIA_V7_CHAPTERS.filter((ch) =>
    completedChapters.includes(ch.id)
  ).length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function markGuardiaV7ChapterComplete(chapterId, storage = localStorage) {
  const prev = loadGuardiaV7Progress(storage);
  const set = new Set(prev.completedChapters);
  const wasNew = !set.has(chapterId);
  set.add(chapterId);
  const next = saveGuardiaV7Progress({ completedChapters: [...set] }, storage);
  return { ...next, wasNew };
}

export function resetGuardiaV7Chapter(chapterId, storage = localStorage) {
  const prev = loadGuardiaV7Progress(storage);
  const set = new Set(prev.completedChapters);
  set.delete(chapterId);
  return saveGuardiaV7Progress({ completedChapters: [...set] }, storage);
}
