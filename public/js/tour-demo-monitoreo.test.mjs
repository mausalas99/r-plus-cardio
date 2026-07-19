import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTourMonitoreoHistorial,
  countTourHistorialWithCoreData,
  getTourRegistroFormSample,
} from './tour-demo-monitoreo.mjs';

test('buildTourMonitoreoHistorial uses today for shift entries', () => {
  const ref = new Date('2026-05-31T14:00:00.000Z');
  const mon = buildTourMonitoreoHistorial(ref);
  assert.ok(mon.historial.length >= 6);
  const todayShifts = mon.historial.filter((m) => {
    const d = new Date(m.recordedAt);
    return (
      d.getFullYear() === ref.getFullYear() &&
      d.getMonth() === ref.getMonth() &&
      d.getDate() === ref.getDate()
    );
  });
  assert.ok(todayShifts.length >= 3, 'TM/TV/TN de hoy');
  const eight = todayShifts.find((m) => new Date(m.recordedAt).getHours() === 8);
  assert.ok(eight);
  assert.equal(eight.glucometrias[0].value, 144);
  assert.equal(eight.vitals.temp, 37);
});

test('getTourRegistroFormSample has TM vitals and glu', () => {
  const s = getTourRegistroFormSample();
  assert.equal(s.ok, true);
  assert.equal(s.vitals.tas, 130);
  assert.equal(s.glucometrias[0].value, 144);
});

test('historial has core data for snapshot and charts', () => {
  const mon = buildTourMonitoreoHistorial(new Date());
  assert.ok(countTourHistorialWithCoreData(mon.historial) >= 5);
  assert.match(mon.textoGuardado.text, /\d{2}\/\d{2}\/\d{4}/);
});
