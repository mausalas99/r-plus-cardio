import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BH_SOME_TREND_ORDER,
  QS_SOME_TREND_ORDER,
  sortTrendSpecsBySomeOrder,
} from './labs.js';

test('BH_SOME_TREND_ORDER sigue biometría SOME (RBC antes que Hb)', () => {
  assert.equal(BH_SOME_TREND_ORDER[0], 'RBC');
  assert.equal(BH_SOME_TREND_ORDER[1], 'Hb');
  assert.ok(BH_SOME_TREND_ORDER.indexOf('NeuPct') < BH_SOME_TREND_ORDER.indexOf('Lin'));
  assert.ok(BH_SOME_TREND_ORDER.indexOf('Plt') < BH_SOME_TREND_ORDER.indexOf('MPV'));
});

test('QS_SOME_TREND_ORDER: glucosa, BUN, creatinina, ácido úrico, lípidos', () => {
  assert.deepEqual(QS_SOME_TREND_ORDER.slice(0, 5), ['Glu', 'BUN', 'Cr', 'eTFG', 'AU']);
  assert.ok(QS_SOME_TREND_ORDER.indexOf('COL') < QS_SOME_TREND_ORDER.indexOf('TGL'));
});

test('sortTrendSpecsBySomeOrder ordena filas de tabla BH', () => {
  var shuffled = [
    { fieldKey: 'Plt', cardTitle: 'Plaquetas' },
    { fieldKey: 'Hb', cardTitle: 'Hb' },
    { fieldKey: 'RBC', cardTitle: 'Eritrocitos' },
    { fieldKey: 'NeuPct', cardTitle: 'Segmentados' },
    { fieldKey: 'Neu', cardTitle: 'Neutrófilos' },
  ];
  var sorted = sortTrendSpecsBySomeOrder('BH', shuffled);
  assert.deepEqual(
    sorted.map(function (s) {
      return s.fieldKey;
    }),
    ['RBC', 'Hb', 'Neu', 'NeuPct', 'Plt']
  );
});

test('sortTrendSpecsBySomeOrder ordena filas QS', () => {
  var shuffled = [
    { fieldKey: 'TGL', cardTitle: 'Triglicéridos' },
    { fieldKey: 'Glu', cardTitle: 'Glucosa' },
    { fieldKey: 'Cr', cardTitle: 'Creatinina' },
    { fieldKey: 'BUN', cardTitle: 'BUN' },
  ];
  var sorted = sortTrendSpecsBySomeOrder('QS', shuffled);
  assert.deepEqual(
    sorted.map(function (s) {
      return s.fieldKey;
    }),
    ['Glu', 'BUN', 'Cr', 'TGL']
  );
});
