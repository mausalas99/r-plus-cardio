import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUIDED_TOUR_PROGRESS_LS_KEY,
  loadTourProgress,
  saveTourProgress,
  clearTourProgress,
} from './onboarding-progress.mjs';

const mem = new Map();

test('save and load round-trip', () => {
  const storage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  saveTourProgress(
    { branch: 'sala', stepId: 'lab_view', chapterId: 'ch-patient-lab', mode: 'base' },
    storage,
  );
  const p = loadTourProgress(storage);
  assert.equal(p.stepId, 'lab_view');
  assert.equal(p.branch, 'sala');
});

test('clearTourProgress removes key', () => {
  const storage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  mem.set(GUIDED_TOUR_PROGRESS_LS_KEY, '{}');
  clearTourProgress(storage);
  assert.equal(loadTourProgress(storage), null);
});
