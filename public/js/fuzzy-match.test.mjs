import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldText, fuzzyScore, rankItems } from './fuzzy-match.mjs';

test('foldText strips accents and lowers', () => {
  assert.equal(foldText('García LÓPEZ'), 'garcia lopez');
});

test('fuzzyScore: every token must match as a subsequence', () => {
  assert.equal(fuzzyScore('xyz', 'Tendencias'), -Infinity);
  assert.equal(fuzzyScore('tend gar', 'Tendencias — Martínez'), -Infinity);
  assert.ok(fuzzyScore('tend gar', 'Tendencias — García') > 0);
});

test('fuzzyScore: word starts beat scattered letters', () => {
  const wordStart = fuzzyScore('tend', 'Tendencias');
  const scattered = fuzzyScore('tend', 'Datos del paciente');
  assert.ok(wordStart > 0);
  assert.ok(scattered === -Infinity || wordStart > scattered);
});

test('rankItems sorts matches and drops non-matches', () => {
  const items = [
    { label: 'Tendencias — García' },
    { label: 'Tendencias — Martínez' },
    { label: 'Cultivos — García' },
    { label: 'Tendencias' },
  ];
  const ranked = rankItems('tend gar', items, (it) => it.label);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].item.label, 'Tendencias — García');
});
