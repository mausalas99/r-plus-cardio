import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeToxicomaniasDetail,
  formatToxicomaniasEntries,
  summarizeToxicomanias,
} from './toxicomanias.mjs';

test('normalizeToxicomaniasDetail migrates legacy text', () => {
  const detail = normalizeToxicomaniasDetail({ toxicomanias: 'Cannabis ocasional' });
  assert.equal(detail.entries.length, 1);
  assert.match(detail.entries[0].customLabel, /Cannabis/);
});

test('formatToxicomaniasEntries includes frequency and years', () => {
  const text = formatToxicomaniasEntries([
    {
      id: '1',
      substanceId: 'cocaine',
      customLabel: '',
      frequency: 'semanal',
      years: '5',
    },
  ]);
  assert.match(text, /Cocaína/);
  assert.match(text, /semanal/);
  assert.match(text, /5 años/);
});

test('summarizeToxicomanias returns Negado when empty', () => {
  const s = summarizeToxicomanias({});
  assert.equal(s.summary, 'Negado');
});
