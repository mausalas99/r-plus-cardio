import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCongestionPanelHtml,
  normalizeCongestionChecklist,
  normalizeLlenadoCapilar,
} from './congestion-panel.mjs';

test('buildCongestionPanelHtml uses R+ date input class', () => {
  var html = buildCongestionPanelHtml({
    date: '2026-03-19',
    checklist: normalizeCongestionChecklist({ pvy: false, llenadoCapilar: '3' }),
    vciCm: 1.63,
    vciCollapse: '≥50%',
    vexus: 0,
    congestionScore: 0,
    lungPattern: 'A',
    lungLinesB: 'escasas',
    stevenson: 'A',
    note: '',
  });
  assert.match(html, /rpc-date-input/);
  assert.match(html, /value="2026-03-19"/);
  assert.match(html, /data-ea-cardio-pocus-day/);
});

test('normalizeCongestionChecklist maps ascitis + llenado digits', () => {
  var cl = normalizeCongestionChecklist({
    pvy: true,
    ascitis: false,
    llenadoCapilar: '3',
  });
  assert.equal(cl.pvy, true);
  assert.equal(cl.ascitisHepatomegalia, false);
  assert.equal(cl.llenadoCapilar, '2-3s');
});

test('normalizeLlenadoCapilar maps legacy digits', () => {
  assert.equal(normalizeLlenadoCapilar('4'), '>3s');
  assert.equal(normalizeLlenadoCapilar('<2s'), '<2s');
  assert.equal(normalizeLlenadoCapilar(''), '');
});
