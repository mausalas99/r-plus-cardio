import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadFundamentosProgress,
  markFundamentosChapterComplete,
  fundamentosModuleCount,
  isFundamentosChapterId,
} from './fundamentos-progress.mjs';

function mockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

test('fundamentosModuleCount is 6', () => {
  assert.equal(fundamentosModuleCount(), 6);
});

test('markFundamentosChapterComplete tracks sala chapters only', () => {
  const storage = mockStorage();
  const r = markFundamentosChapterComplete('ch-patient-lab', storage);
  assert.equal(r.wasNew, true);
  assert.equal(isFundamentosChapterId('ch-patient-lab'), true);
  assert.equal(isFundamentosChapterId('ch-ic-lab'), false);
  const ignored = markFundamentosChapterComplete('ch-ic-lab', storage);
  assert.equal(ignored.wasNew, false);
  assert.deepEqual(loadFundamentosProgress(storage).completedChapters, ['ch-patient-lab']);
});
