import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeHcPatch } from './merge-hc-patch.mjs';

test('mergeHcPatch fill mode only writes empty strings', () => {
  const existing = { motivoConsulta: 'DOLOR', padecimientoActual: '' };
  const patch = { motivoConsulta: 'OTRO', padecimientoActual: 'PEEA LARGO' };
  const out = mergeHcPatch(existing, patch, 'fill');
  assert.equal(out.motivoConsulta, 'DOLOR');
  assert.equal(out.padecimientoActual, 'PEEA LARGO');
});

test('mergeHcPatch replace overwrites present sections', () => {
  const existing = { motivoConsulta: 'DOLOR' };
  const patch = { motivoConsulta: 'OTRO' };
  const out = mergeHcPatch(existing, patch, 'replace');
  assert.equal(out.motivoConsulta, 'OTRO');
});
