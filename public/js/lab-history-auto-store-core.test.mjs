import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLabLine,
  areLabSetsEquivalent,
  isDuplicateAgainstLatest,
  areDuplicateLabSets,
  findDuplicateLabSetIdsToRemove,
  findNormalizedSourceDuplicateGroups,
  findConflictingSameDateTimeGroups,
} from './lab-history-auto-store-core.mjs';

test('normalizeLabLine colapsa espacios y trim', () => {
  assert.equal(normalizeLabLine('  Hb   12.1   g/dL  '), 'Hb 12.1 g/dL');
});

test('areLabSetsEquivalent detecta igualdad semantica', () => {
  var a = ['Hb  12.1 g/dL', 'Cr 1.0 mg/dL'];
  var b = [' Hb 12.1 g/dL ', 'Cr   1.0 mg/dL'];
  assert.equal(areLabSetsEquivalent(a, b), true);
});

test('isDuplicateAgainstLatest true cuando coincide fecha/hora/labs', () => {
  var latest = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1'] };
  var incoming = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1'] };
  assert.equal(isDuplicateAgainstLatest(latest, incoming), true);
});

test('isDuplicateAgainstLatest false cuando cambia hora', () => {
  var latest = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1'] };
  var incoming = { fecha: '01/05/2026', hora: '10:00', resLabs: ['Hb 12.1'] };
  assert.equal(isDuplicateAgainstLatest(latest, incoming), false);
});

test('isDuplicateAgainstLatest false cuando cambia una linea', () => {
  var latest = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1', 'Cr 1.0'] };
  var incoming = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1', 'Cr 1.1'] };
  assert.equal(isDuplicateAgainstLatest(latest, incoming), false);
});

test('areDuplicateLabSets simétrico', () => {
  var x = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1'] };
  var y = { fecha: '01/05/2026', hora: '08:30', resLabs: ['Hb 12.1'] };
  assert.equal(areDuplicateLabSets(x, y), true);
  assert.equal(areDuplicateLabSets(y, x), true);
});

test('findDuplicateLabSetIdsToRemove conserva id más antiguo', () => {
  var sets = [
    { id: '200', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 12.1'] },
    { id: '100', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 12.1'] },
  ];
  assert.deepEqual(findDuplicateLabSetIdsToRemove(sets), ['200']);
});

test('findDuplicateLabSetIdsToRemove cadena triple deja uno', () => {
  var sets = [
    { id: '10', fecha: '01/01/2026', hora: '10:00', resLabs: ['A'] },
    { id: '20', fecha: '01/01/2026', hora: '10:00', resLabs: ['A'] },
    { id: '30', fecha: '01/01/2026', hora: '10:00', resLabs: ['A'] },
  ];
  var rm = findDuplicateLabSetIdsToRemove(sets).sort();
  assert.deepEqual(rm, ['20', '30']);
});

test('findDuplicateLabSetIdsToRemove vacío si hora distinta', () => {
  var sets = [
    { id: '100', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 12.1'] },
    { id: '200', fecha: '01/01/2026', hora: '11:00', resLabs: ['Hb 12.1'] },
  ];
  assert.deepEqual(findDuplicateLabSetIdsToRemove(sets), []);
});

test('findNormalizedSourceDuplicateGroups mismo sourceText distinto id', () => {
  var longSrc =
    'LABORATORIO CLÍNICO INFORME MUY LARGO PARA SUPERAR UMBRAL DE FILTRO mínimo requerido en el analizador de duplicados';
  var sets = [
    { id: '1', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 12'], sourceText: longSrc },
    { id: '2', fecha: '02/01/2026', hora: '', resLabs: ['Cr 1'], sourceText: '  ' + longSrc + '  ' },
  ];
  var g = findNormalizedSourceDuplicateGroups(sets);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].ids.sort(), ['1', '2']);
});

test('findConflictingSameDateTimeGroups detecta misma fecha/hora labs distintos', () => {
  var sets = [
    { id: '1', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 12'] },
    { id: '2', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 13'] },
  ];
  var g = findConflictingSameDateTimeGroups(sets);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].ids.sort(), ['1', '2']);
});

test('findConflictingSameDateTimeGroups vacío si contenido equivalente', () => {
  var sets = [
    { id: '1', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb  12'] },
    { id: '2', fecha: '01/01/2026', hora: '10:00', resLabs: ['Hb 12'] },
  ];
  assert.deepEqual(findConflictingSameDateTimeGroups(sets), []);
});
