import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendDoseSegment,
  endDoseSegment,
  listActiveMeds,
  sumFurosemidaMg,
  parseDosisDailyMg,
  segmentDayCount,
  addCatalogTipo,
  FANTASTICO_CLASSES,
  FANTASTICO_DRUGS_BY_CLASS,
  fantasticoDrugOptions,
} from './med-segments.mjs';

test('FANTASTICO_CLASSES has four pillars', () => {
  assert.equal(FANTASTICO_CLASSES.length, 4);
});

test('fantasticoDrugOptions are class-specific (no Furosemida in SGLT2i)', () => {
  FANTASTICO_CLASSES.forEach(function (cls) {
    assert.ok(Array.isArray(FANTASTICO_DRUGS_BY_CLASS[cls]));
    assert.ok(FANTASTICO_DRUGS_BY_CLASS[cls].length >= 2);
  });
  var sglt = fantasticoDrugOptions('SGLT2i');
  assert.ok(sglt.includes('Dapagliflozina'));
  assert.ok(sglt.includes('Empagliflozina'));
  assert.equal(
    sglt.some(function (d) {
      return /furosemida/i.test(d);
    }),
    false
  );
  var ieca = fantasticoDrugOptions('IECA/ARA/ARNI');
  assert.ok(ieca.some(function (d) {
    return /sacubitril|enalapril|valsart/i.test(d);
  }));
  assert.deepEqual(fantasticoDrugOptions('SGLT2i', 'CustomSglt'), sglt.concat(['CustomSglt']));
  assert.deepEqual(fantasticoDrugOptions('SGLT2i', 'Furosemida'), sglt);
  assert.deepEqual(fantasticoDrugOptions('SGLT2i', 'Bisoprolol'), sglt);
});

test('dose history and active list', () => {
  let segs = [];
  segs = appendDoseSegment(segs, {
    tipo: 'Furosemida',
    inicio: '2026-03-13',
    dosis: '80 mg IV cada 12h',
    indicacion: 'Descongestión',
  });
  segs = endDoseSegment(segs, segs[0].id, '2026-03-17');
  segs = appendDoseSegment(segs, {
    tipo: 'Furosemida',
    inicio: '2026-03-17',
    dosis: '40 mg VO cada 12h',
    indicacion: 'Descongestión',
  });
  const active = listActiveMeds(segs);
  assert.equal(active.length, 1);
  assert.match(active[0].dosis, /40 mg/);
});

test('sumFurosemidaMg prefers explicit mgTotal', () => {
  const withTotals = [
    { tipo: 'Furosemida', mgTotal: 640 },
    { tipo: 'Bumetanida', mgTotal: 4 },
    { tipo: 'Furosemida', mgTotal: 160 },
  ];
  assert.equal(sumFurosemidaMg(withTotals), 800);
});

test('parseDosisDailyMg: 80 cada 12h → 160 mg/día', () => {
  assert.equal(parseDosisDailyMg('80 mg IV cada 12h'), 160);
  assert.equal(parseDosisDailyMg('40 mg VO cada 12 horas'), 80);
  assert.equal(parseDosisDailyMg('80 mg DU bolo'), 80);
});

test('segmentDayCount: endedAt is inclusive last day', () => {
  assert.equal(segmentDayCount('2026-07-18', '2026-07-18', '2026-07-19'), 1);
  assert.equal(segmentDayCount('2026-07-14', '2026-07-16', '2026-07-19'), 3);
  assert.equal(segmentDayCount('2026-07-19', null, '2026-07-19'), 1);
});

test('sumFurosemidaMg auto: ayer 80 c/12 + hoy 40 c/12 = 240', () => {
  const segs = [
    {
      tipo: 'Furosemida',
      inicio: '2026-07-18',
      endedAt: '2026-07-18',
      dosis: '80 mg IV cada 12h',
    },
    {
      tipo: 'Furosemida',
      inicio: '2026-07-19',
      dosis: '40 mg VO cada 12h',
    },
  ];
  assert.equal(sumFurosemidaMg(segs, '2026-07-19'), 240);
});

test('catalog add is idempotent by tipo', () => {
  let cat = [];
  cat = addCatalogTipo(cat, { tipo: 'Enoxaparina', defaultIndicacion: 'Anticoagulación' });
  cat = addCatalogTipo(cat, { tipo: 'Enoxaparina', defaultIndicacion: 'other' });
  assert.equal(cat.length, 1);
});
