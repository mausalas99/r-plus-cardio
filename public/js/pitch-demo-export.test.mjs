import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPitchDemoPatientExport,
  buildPitchDemoBundleExport,
  PITCH_DEMO_EXPORT_REF,
} from './pitch-demo-export.mjs';
import { collectGlucometriasForRegistroWindow } from './features/estado-actual-registro-defaults.mjs';

test('buildPitchDemoPatientExport: DEMO PÉREZ con labs, monitoreo y glucometrías', () => {
  const payload = buildPitchDemoPatientExport();
  assert.equal(payload.format, 'r-plus-patient-export');
  assert.equal(payload.version, 1);
  assert.equal(payload.patient.nombre, 'DEMO PÉREZ');
  assert.ok(Array.isArray(payload.labHistory) && payload.labHistory.length >= 5);
  const historial = payload.patient.monitoreo && payload.patient.monitoreo.historial;
  assert.ok(Array.isArray(historial) && historial.length >= 10);
  const glus = collectGlucometriasForRegistroWindow(historial, PITCH_DEMO_EXPORT_REF);
  assert.ok(glus.length >= 2, 'glucometrías en ventana de gráfica (ayer 08:00–hoy 00:00)');
});

test('buildPitchDemoBundleExport: solo Pérez', () => {
  const bundle = buildPitchDemoBundleExport();
  assert.equal(bundle.patients.length, 1);
  assert.equal(bundle.patients[0].patient.nombre, 'DEMO PÉREZ');
});
