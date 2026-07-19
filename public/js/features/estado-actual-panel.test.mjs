import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEaSavedLabel,
  toDatetimeLocalValue,
  datetimeLocalToIso,
  isoToHHmm,
  parseNumOrNull,
} from './estado-actual-panel.mjs';

test('formatEaSavedLabel — fecha legible', () => {
  assert.equal(formatEaSavedLabel('2026-05-26T14:30:00.000Z'), formatEaSavedLabel('2026-05-26T14:30:00.000Z'));
  assert.match(formatEaSavedLabel('2026-05-26T14:30:00.000Z'), /^Guardado \d{2}\/\d{2} \d{2}:\d{2}$/);
});

test('datetimeLocalToIso e isoToHHmm — roundtrip coherente', () => {
  const local = toDatetimeLocalValue('2026-05-26T08:15:00.000Z');
  const iso = datetimeLocalToIso(local);
  assert.ok(iso);
  assert.match(isoToHHmm(iso), /^\d{2}:\d{2}$/);
});

test('parseNumOrNull — vacío o no numérico → null', () => {
  assert.equal(parseNumOrNull(''), null);
  assert.equal(parseNumOrNull('abc'), null);
  assert.equal(parseNumOrNull('82'), 82);
});
