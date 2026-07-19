import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaletteItems, rankPalette } from './command-palette-model.mjs';

const SALA = { appMode: 'sala' };
const PATIENTS = [
  { id: 1, nombre: 'García López, Juan', cuarto: '412' },
  { id: 2, nombre: 'Martínez, Ana', cuarto: '410' },
];

test('buildPaletteItems: sections, app tabs, patients, and combos', () => {
  const items = buildPaletteItems(SALA, PATIENTS);
  assert.ok(items.some((it) => it.kind === 'section' && it.section === 'tend'));
  assert.ok(items.some((it) => it.kind === 'app-tab' && it.tab === 'lab'));
  assert.ok(items.some((it) => it.kind === 'patient' && it.patientId === 1));
  assert.ok(
    items.some(
      (it) => it.kind === 'patient-section' && it.patientId === 1 && it.section === 'tend'
    )
  );
});

test('rankPalette: "tend gar" resolves to Tendencias of García', () => {
  const items = buildPaletteItems(SALA, PATIENTS);
  const top = rankPalette('tend gar', items, 12);
  assert.ok(top.length >= 1);
  assert.equal(top[0].kind, 'patient-section');
  assert.equal(top[0].patientId, 1);
  assert.equal(top[0].section, 'tend');
});

test('rankPalette: empty query lists patients and sections, capped', () => {
  const items = buildPaletteItems(SALA, PATIENTS);
  const top = rankPalette('', items, 12);
  assert.ok(top.length > 0 && top.length <= 12);
  assert.ok(top.every((it) => it.kind === 'patient' || it.kind === 'section'));
});
