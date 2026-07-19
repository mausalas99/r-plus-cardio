import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTourDemoEventualidades } from './tour-demo-eventualidades.mjs';
import { dayKeyFromIso } from './features/eventualidades-panel.mjs';

test('buildTourDemoEventualidades crea tres días distintos', () => {
  const ref = new Date(2026, 4, 31, 12, 0, 0);
  const store = buildTourDemoEventualidades(ref);
  assert.equal(store.entries.length, 3);
  const keys = store.entries.map(function (e) {
    return dayKeyFromIso(e.at);
  });
  assert.equal(new Set(keys).size, 3);
  assert.match(store.entries[0].text, /ingreso|Ingreso/i);
});
