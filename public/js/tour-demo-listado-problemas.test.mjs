import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTourDemoListadoProblemas,
  TOUR_DEMO_PERITONITIS_BLOCK,
} from './tour-demo-listado-problemas.mjs';

test('buildTourDemoListadoProblemas usa bloques A) B) C) en mayúsculas', () => {
  const l = buildTourDemoListadoProblemas('11/04/2026', '09:30');
  assert.equal(l.fecha, '11/04/2026');
  assert.equal(l.activos[0].descripcion, TOUR_DEMO_PERITONITIS_BLOCK);
  assert.match(l.activos[0].descripcion, /A\) CLÍNICA:/);
  assert.match(l.activos[0].descripcion, /B\) EXPLORACIÓN FÍSICA:/);
  assert.match(l.activos[0].descripcion, /C\) PARACLÍNICA:/);
  assert.ok(l.inactivos.length >= 1);
});
