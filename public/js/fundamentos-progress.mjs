import { SALA_CHAPTERS } from './onboarding-curriculum.mjs';

export const FUNDAMENTOS_PROGRESS_LS_KEY = 'rpc-fundamentos-progress';

/** @returns {{ completedChapters: string[], updatedAt: number|null }} */
export function loadFundamentosProgress(storage = localStorage) {
  try {
    const raw = storage.getItem(FUNDAMENTOS_PROGRESS_LS_KEY);
    if (!raw) return { completedChapters: [], updatedAt: null };
    const p = JSON.parse(raw);
    return {
      completedChapters: Array.isArray(p.completedChapters) ? p.completedChapters : [],
      updatedAt: p.updatedAt || null,
    };
  } catch {
    return { completedChapters: [], updatedAt: null };
  }
}

export function saveFundamentosProgress(patch, storage = localStorage) {
  const prev = loadFundamentosProgress(storage);
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  storage.setItem(FUNDAMENTOS_PROGRESS_LS_KEY, JSON.stringify(next));
  return next;
}

export function isFundamentosChapterId(chapterId) {
  return SALA_CHAPTERS.some((ch) => ch.id === chapterId);
}

export function fundamentosModuleCount() {
  return SALA_CHAPTERS.length;
}

export function markFundamentosChapterComplete(chapterId, storage = localStorage) {
  if (!isFundamentosChapterId(chapterId)) {
    return { ...loadFundamentosProgress(storage), wasNew: false };
  }
  const prev = loadFundamentosProgress(storage);
  const set = new Set(prev.completedChapters);
  const wasNew = !set.has(chapterId);
  set.add(chapterId);
  const next = saveFundamentosProgress({ completedChapters: [...set] }, storage);
  return { ...next, wasNew };
}
