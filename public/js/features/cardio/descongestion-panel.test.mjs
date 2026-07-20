import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDescongestionHeaderHtml,
  collectActiveMedRows,
  extractDailyDiuresisMl,
} from './descongestion-panel.mjs';
import { parseTriStateValue, buildTriStateSelectHtml } from './congestion-panel.mjs';

test('buildDescongestionHeaderHtml includes days and override badge', () => {
  var html = buildDescongestionHeaderHtml({
    ingresoDate: '2026-03-13',
    inicioDescongestion: '2026-03-13',
    diasInternamiento: 7,
    diasDescongestion: 7,
    diuresisAcumuladaMl: 17245,
    furosemidaAcumuladaMg: 800,
    diuresisOverridden: true,
    furosemidaOverridden: false,
    activeMeds: [{ label: 'Furosemida', dosis: '40 mg IV' }],
  });
  assert.match(html, /Inicio descongestión/);
  assert.match(html, /rpc-date-input/);
  assert.match(html, />7</);
  assert.match(html, /Diuresis acumulada/);
  assert.match(html, /ea-cardio-override-badge">manual/);
  assert.match(html, /Furosemida/);
  assert.match(html, /40 mg IV/);
  assert.match(html, /data-ea-cardio-recalc="diuresisAcumuladaMl"/);
});

test('resolveClinicalAsOfYmd prefers latest POCUS day over today', async () => {
  const { resolveClinicalAsOfYmd } = await import('./descongestion-panel.mjs');
  const ymd = resolveClinicalAsOfYmd({
    fimiFecha: '2026-03-13',
    cardio: {
      inicioDescongestion: '2026-03-13',
      pocusByDay: [
        { date: '2026-03-13' },
        { date: '2026-03-19' },
        { date: '2026-03-15' },
      ],
    },
    monitoreo: { historial: [] },
  });
  assert.equal(ymd, '2026-03-19');
});

test('extractDailyDiuresisMl sums per local day from historial', () => {
  var ml = extractDailyDiuresisMl({
    historial: [
      {
        recordedAt: new Date(2026, 2, 14, 8, 0, 0).toISOString(),
        io: { egrParts: [{ kind: 'diuresis', label: 'DIURESIS', value: 1000 }] },
      },
      {
        recordedAt: new Date(2026, 2, 14, 20, 0, 0).toISOString(),
        io: { egrParts: [{ kind: 'diuresis', label: 'DIURESIS', value: 900 }] },
      },
      {
        recordedAt: new Date(2026, 2, 15, 8, 0, 0).toISOString(),
        io: { egr: 1800 },
      },
    ],
  });
  assert.deepEqual(ml, [1900, 1800]);
});

test('collectActiveMedRows merges segments and fantásticos', () => {
  var rows = collectActiveMedRows({
    medSegments: [{ tipo: 'Espironolactona', dosis: '25 mg', endedAt: null }],
    diureticSegments: [{ tipo: 'Furosemida', dosis: '40 mg', endedAt: '2026-03-01' }],
    fantasticos: [{ className: 'SGLT2i', drug: 'Dapagliflozina', dosis: '10 mg' }],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, 'Espironolactona');
  assert.match(rows[1].label, /Dapagliflozina/);
});

test('parseTriStateValue and select builder', () => {
  assert.equal(parseTriStateValue('1'), true);
  assert.equal(parseTriStateValue('0'), false);
  assert.equal(parseTriStateValue(''), null);
  var html = buildTriStateSelectHtml('pvy', true, 'ea-cardio-pvy');
  assert.match(html, /data-ea-cardio-check="pvy"/);
  assert.match(html, /value="1" selected/);
});
