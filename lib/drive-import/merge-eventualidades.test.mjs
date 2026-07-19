import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterNewEventualidades } from './merge-eventualidades.mjs';

test('filterNewEventualidades skips duplicate keys', () => {
  const existing = [{ at: '2026-06-01T18:00:00.000Z', text: 'SE INDICA DIETA' }];
  const incoming = [
    { at: '2026-06-01T18:00:00.000Z', text: 'SE INDICA DIETA' },
    { at: '2026-06-02T18:00:00.000Z', text: 'NUEVO' },
  ];
  const { toAdd, skipped } = filterNewEventualidades(existing, incoming);
  assert.equal(toAdd.length, 1);
  assert.equal(skipped, 1);
});
