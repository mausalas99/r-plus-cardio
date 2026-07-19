import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPresentationShortcut } from './presentation-mode.mjs';

test('isPresentationShortcut: KeyP con modificadores', () => {
  assert.equal(
    isPresentationShortcut({
      altKey: true,
      metaKey: true,
      shiftKey: true,
      code: 'KeyP',
      key: 'π',
    }),
    true
  );
});

test('isPresentationShortcut: rechaza sin Option', () => {
  assert.equal(
    isPresentationShortcut({
      altKey: false,
      metaKey: true,
      shiftKey: true,
      code: 'KeyP',
      key: 'P',
    }),
    false
  );
});

test('isPresentationShortcut: Ctrl en lugar de Meta (Windows)', () => {
  assert.equal(
    isPresentationShortcut({
      altKey: true,
      ctrlKey: true,
      shiftKey: true,
      code: 'KeyP',
      key: 'P',
    }),
    true
  );
});
