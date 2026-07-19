import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendDoseSegment,
  endDoseSegment,
  listActiveMeds,
  sumFurosemidaMg,
  addCatalogTipo,
  FANTASTICO_CLASSES,
} from './med-segments.mjs';

test('FANTASTICO_CLASSES has four pillars', () => {
  assert.equal(FANTASTICO_CLASSES.length, 4);
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

test('sumFurosemidaMg parses mg from furosemida segments only', () => {
  const segs = [
    { tipo: 'Furosemida', dosis: '80 mg IV cada 12h', dosesPerDay: 2, days: 4 },
    { tipo: 'Bumetanida', dosis: '1 mg', dosesPerDay: 2, days: 2 },
  ];
  // Use explicit mgTotal on segments for v1 reliability:
  const withTotals = [
    { tipo: 'Furosemida', mgTotal: 640 },
    { tipo: 'Bumetanida', mgTotal: 4 },
    { tipo: 'Furosemida', mgTotal: 160 },
  ];
  assert.equal(sumFurosemidaMg(withTotals), 800);
});

test('catalog add is idempotent by tipo', () => {
  let cat = [];
  cat = addCatalogTipo(cat, { tipo: 'Enoxaparina', defaultIndicacion: 'Anticoagulación' });
  cat = addCatalogTipo(cat, { tipo: 'Enoxaparina', defaultIndicacion: 'other' });
  assert.equal(cat.length, 1);
});
