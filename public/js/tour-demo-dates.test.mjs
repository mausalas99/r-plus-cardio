import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTourDemoDates,
  patchSomeLabFechaRegistro,
  formatTourIsoDate,
  addTourDays,
} from './tour-demo-dates.mjs';
import { DEMO_SOME_LAB_REPORT } from './tour-demo-some-lab.mjs';

test('buildTourDemoDates anchors ingreso and labs to ref date', () => {
  const ref = new Date('2026-05-31T15:30:00');
  const b = buildTourDemoDates(ref);
  assert.equal(b.fecha, '31/05/2026');
  assert.equal(b.fiuxFecha, '2026-05-29');
  assert.equal(b.fimiFecha, '2026-05-30');
  assert.equal(b.labFechaOlder, '23/05/2026');
  assert.equal(b.labFechaNewer, '30/05/2026');
  assert.match(b.demoSomeLabReport, /Fecha Registro:\tMay 30 2026 9:42AM/);
  assert.match(b.olderDemoSomeLabReport, /Fecha Registro:\tMay 23 2026 7:18AM/);
  assert.match(b.demoGarciaLabReport, /Fecha Registro:\tMay 31 2026 11:05AM/);
});

test('patchSomeLabFechaRegistro replaces header line only', () => {
  const d = addTourDays(new Date('2026-05-31T12:00:00'), -3);
  const out = patchSomeLabFechaRegistro(DEMO_SOME_LAB_REPORT, d, { hour: 14, minute: 5 });
  assert.match(out, /Fecha Registro:\tMay 28 2026 2:05PM/);
  assert.ok(out.includes('HGB'));
});

test('formatTourIsoDate is stable', () => {
  assert.equal(formatTourIsoDate(new Date('2026-01-05T12:00:00')), '2026-01-05');
});
