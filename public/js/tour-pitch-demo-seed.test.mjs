import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procesarLabs } from './labs.js';
import {
  buildPitchMonitoreoHistorial,
  buildPitchLabHistoryEntries,
  countDistinctLocalDaysInHistorial,
  countHistorialWithCoreData,
  getPitchCultivoParseText,
  filterPatientsForPitchTour,
  setPitchPatientIsolation,
  PITCH_DEMO_PATIENT_ID,
} from './tour-pitch-demo-seed.mjs';
import { collectGlucometriasForRegistroWindow } from './features/estado-actual-registro-defaults.mjs';
import {
  PITCH_CULTIVO_LAB_SPECS,
  PITCH_CULTIVO_PERITONEAL_SOME,
} from './tour-pitch-cultivos-some.mjs';
import { isParsedCultivoHeaderLine, parseCuentaFromCultivoChunkLines } from './labs.js';

test('PITCH_CULTIVO_PERITONEAL_SOME: antibiograma con S y R en sourceText', () => {
  assert.match(PITCH_CULTIVO_PERITONEAL_SOME, /CEFTAZIDIMA\n>16\tR/);
  assert.match(PITCH_CULTIVO_PERITONEAL_SOME, /CIPROFLOXACINA\n<=1\tS/);
  const { resLabs } = procesarLabs(PITCH_CULTIVO_PERITONEAL_SOME);
  assert.match(resLabs.join('\n'), /PSEUDOMONAS/i);
});

test('getPitchCultivoParseText incluye aspirado traqueal multipaciente', () => {
  const text = getPitchCultivoParseText();
  assert.match(text, /ASPIRADO TRAQUEAL/i);
  assert.match(text, /Escherichia coli/i);
  assert.match(text, /Acinetobacter baumannii/i);
});

test('PITCH_CULTIVO_LAB_SPECS: bloques condensados incluyen línea Cuenta UFC', () => {
  const cuentas = [];
  PITCH_CULTIVO_LAB_SPECS.forEach(function (spec) {
    const { resLabs } = procesarLabs(spec.report);
    resLabs.forEach(function (chunk) {
      String(chunk || '')
        .split(/\n\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach(function (sec) {
          const lines = sec.split(/\r?\n/).map((l) => l.replace(/\*+$/g, '').trim()).filter(Boolean);
          if (!lines.length || !isParsedCultivoHeaderLine(lines[0])) return;
          const cuenta = parseCuentaFromCultivoChunkLines(lines.slice(1));
          if (cuenta) cuentas.push(cuenta);
        });
    });
  });
  assert.ok(cuentas.length >= 6, 'expected cuenta on multipatient culture blocks');
  assert.ok(cuentas.some((c) => /50,000 UFC/i.test(c)));
  assert.ok(cuentas.some((c) => /120,000 UFC/i.test(c)));
  assert.ok(cuentas.some((c) => /2 colonias/i.test(c)));
});

test('buildPitchLabHistoryEntries: cultivos con sourceText y múltiples fechas', () => {
  const entries = buildPitchLabHistoryEntries();
  const cult = entries.filter((e) => String(e.id).includes('cult'));
  assert.equal(cult.length, 5);
  cult.forEach((e) => {
    assert.ok(e.sourceText && e.sourceText.length > 100);
  });
  const fechas = new Set(cult.map((e) => e.fecha));
  assert.ok(fechas.size >= 4);
});

test('filterPatientsForPitchTour oculta pacientes reales durante el pitch', () => {
  setPitchPatientIsolation(true);
  const mixed = [
    { id: PITCH_DEMO_PATIENT_ID, nombre: 'DEMO PÉREZ' },
    { id: 'real-1', nombre: 'REAL UNO' },
    { id: 'demo-pitch-2', nombre: 'LEGACY GARCÍA' },
  ];
  const visible = filterPatientsForPitchTour(mixed);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, PITCH_DEMO_PATIENT_ID);
  setPitchPatientIsolation(false);
  assert.equal(filterPatientsForPitchTour(mixed).length, 3);
});

test('buildPitchLabHistoryEntries: al menos 5 días de laboratorio', () => {
  const entries = buildPitchLabHistoryEntries();
  assert.ok(entries.length >= 5);
  const fechas = new Set(entries.map((e) => e.fecha));
  assert.ok(fechas.size >= 5);
});

test('buildPitchMonitoreoHistorial: 3 días locales y 8+ mediciones con datos', () => {
  const mon = buildPitchMonitoreoHistorial(new Date('2026-05-28T15:00:00.000Z'));
  const hist = mon.historial;
  assert.ok(Array.isArray(hist));
  assert.ok(hist.length >= 8);
  assert.equal(countDistinctLocalDaysInHistorial(hist), 3);
  assert.ok(countHistorialWithCoreData(hist) >= 8);
});

test('buildPitchMonitoreoHistorial: glucometrías en ventana ayer 08:00–hoy 00:00 (gráfica)', () => {
  const now = new Date('2026-05-29T12:00:00');
  const mon = buildPitchMonitoreoHistorial(now);
  const glus = collectGlucometriasForRegistroWindow(mon.historial, now);
  assert.ok(glus.length >= 2, 'expected glucometrías plotables in registro window');
});
