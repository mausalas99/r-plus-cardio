import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowLwwToast, resetLwwToastDebounceForTests } from './lan-lww-toast.mjs';

test('debounces duplicate entity toasts within window', () => {
  resetLwwToastDebounceForTests();
  assert.equal(shouldShowLwwToast('patient', 'p1'), true);
  assert.equal(shouldShowLwwToast('patient', 'p1'), false);
});
