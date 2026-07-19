import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeTrendSetsForSeries, buildTrendAxisMeta, classifyTendPanelFamily, familyOrderForSection, migratePanelFamilyKey, formatTendSeriesLabel, parseTrendNumeric, formatTrendColumnHeader } from './tend-core.mjs';

function mockSet(fecha, hora, sectionKey, fieldKey, val) {
  return {
    fecha,
    hora,
    parsedBySection: {
      [sectionKey]: { [fieldKey]: { val: String(val), ab: false } }
    }
  };
}

test('dedupe: mismo día distinta hora → dos sets', () => {
  const sets = [
    mockSet('18/05/2026', '03:24', 'BH', 'Hb', 12),
    mockSet('18/05/2026', '14:00', 'BH', 'Hb', 11.5)
  ];
  const out = dedupeTrendSetsForSeries(sets, 'BH', 'Hb');
  assert.equal(out.length, 2);
});

test('dedupe: misma fecha hora y valor → uno', () => {
  const sets = [
    mockSet('18/05/2026', '03:24', 'BH', 'Hb', 12),
    mockSet('18/05/2026', '03:24', 'BH', 'Hb', 12)
  ];
  const out = dedupeTrendSetsForSeries(sets, 'BH', 'Hb');
  assert.equal(out.length, 1);
});

test('buildTrendAxisMeta: mismo día → x distintos', () => {
  const sets = [
    mockSet('18/05/2026', '03:24', 'BH', 'Hb', 12),
    mockSet('18/05/2026', '14:00', 'BH', 'Hb', 11.5)
  ];
  const meta = buildTrendAxisMeta(sets);
  assert.equal(meta.points.length, 2);
  assert.notEqual(meta.points[0].x, meta.points[1].x);
  assert.match(meta.points[0].dayLabel, /18\/05/);
});

test('classifyTendPanelFamily: gases y QS genérico', () => {
  assert.equal(classifyTendPanelFamily('GASES', 'pH', '%'), 'gases');
  assert.equal(classifyTendPanelFamily('QS', 'Glu', 'mg/dL'), 'absolute');
});

test('classifyTendPanelFamily: BH en 4 paneles', () => {
  assert.equal(classifyTendPanelFamily('BH', 'Hb', 'g/dL'), 'bh-absolute');
  assert.equal(classifyTendPanelFamily('BH', 'Neu', 'K/μL'), 'bh-absolute');
  assert.equal(classifyTendPanelFamily('BH', 'Leu', 'K/μL'), 'bh-absolute');
  assert.equal(classifyTendPanelFamily('BH', 'Plt', 'K/μL'), 'bh-absolute');
  assert.equal(classifyTendPanelFamily('BH', 'RDW', '%'), 'bh-quality');
  assert.equal(classifyTendPanelFamily('BH', 'VCM', 'fL'), 'bh-quality');
  assert.equal(classifyTendPanelFamily('BH', 'CHCM', 'g/dL'), 'bh-quality');
  assert.equal(classifyTendPanelFamily('BH', 'Hto', '%'), 'bh-quality');
  assert.equal(classifyTendPanelFamily('BH', 'NeuPct', '%'), 'bh-diff-manual');
  assert.equal(classifyTendPanelFamily('BH', 'Bandas', '%'), 'bh-diff-manual');
  assert.equal(classifyTendPanelFamily('BH', 'TP', 's'), 'bh-coag');
  assert.equal(classifyTendPanelFamily('BH', 'INR', ''), 'bh-coag');
});

test('familyOrderForSection: BH tiene 4 familias', () => {
  const order = familyOrderForSection('BH');
  assert.equal(order.length, 4);
  assert.deepEqual(order, ['bh-absolute', 'bh-quality', 'bh-diff-manual', 'bh-coag']);
});

test('migratePanelFamilyKey: BH legacy', () => {
  assert.equal(migratePanelFamilyKey('BH', 'percent-rbc'), 'bh-quality');
  assert.equal(migratePanelFamilyKey('BH', 'percent-diff'), 'bh-diff-manual');
  assert.equal(migratePanelFamilyKey('BH', 'bh-diff'), 'bh-diff-manual');
  assert.equal(migratePanelFamilyKey('BH', 'absolute'), 'bh-absolute');
  assert.equal(migratePanelFamilyKey('QS', 'absolute'), 'absolute');
});

test('formatTrendColumnHeader: hora solo si mismo día con horas distintas', () => {
  const solo = [mockSet('18/05/2026', '06:43', 'BH', 'Hb', 12)];
  assert.equal(formatTrendColumnHeader(solo[0], solo), '18/05/2026');

  const mismoDia = [
    mockSet('18/05/2026', '06:43', 'BH', 'Hb', 12),
    mockSet('18/05/2026', '14:00', 'BH', 'Hb', 11)
  ];
  assert.equal(formatTrendColumnHeader(mismoDia[0], mismoDia), '18/05/2026 06:43');
  assert.equal(formatTrendColumnHeader(mismoDia[1], mismoDia), '18/05/2026 14:00');

  const diasDistintos = [
    mockSet('17/05/2026', '06:43', 'BH', 'Hb', 12),
    mockSet('18/05/2026', '14:00', 'BH', 'Hb', 11)
  ];
  assert.equal(formatTrendColumnHeader(diasDistintos[0], diasDistintos), '17/05/2026');
  assert.equal(formatTrendColumnHeader(diasDistintos[1], diasDistintos), '18/05/2026');
});

test('buildTrendAxisMeta: etiquetas sin hora si un solo estudio por día', () => {
  const sets = [
    mockSet('17/05/2026', '08:00', 'BH', 'Hb', 12),
    mockSet('18/05/2026', '14:00', 'BH', 'Hb', 11)
  ];
  const meta = buildTrendAxisMeta(sets);
  assert.equal(meta.labels[0], '17/05');
  assert.equal(meta.labels[1], '18/05');
});

test('formatTendSeriesLabel: sin porcentaje duplicado', () => {
  const f = formatTendSeriesLabel('Monocitos %', 'MonoPct', '%');
  assert.equal(f.name, 'Monocitos');
  assert.equal(f.unit, '%');
});

test('parseTrendNumeric: menor que y decimales', () => {
  assert.equal(parseTrendNumeric('<0.01'), 0.01);
  assert.equal(parseTrendNumeric('0,08'), 0.08);
  assert.equal(parseTrendNumeric({ val: '4.08*' }), 4.08);
});
