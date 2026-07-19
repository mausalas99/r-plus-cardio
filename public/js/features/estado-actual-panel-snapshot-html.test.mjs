import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSnapshot } from './estado-actual-data.mjs';
import {
  renderSnapshotVitalsHtml,
  getVitalHistoryEntries,
  vitalHasHistory,
  renderVitalHistoryListHtml,
} from './estado-actual-panel-snapshot-html.mjs';

test('renderSnapshotVitalsHtml — T/A unificada, fecha en cierre sin @ 00:00', () => {
  var recordedAt = new Date(2026, 5, 26, 0, 0, 0).toISOString();
  /** @type {any} */
  var monitoreo = {
    estadoClinico: {},
    confirmado: {},
    pendienteReceta: {},
    historial: [
      {
        id: '1',
        recordedAt: new Date(2026, 5, 25, 0, 0, 0).toISOString(),
        vitals: { tas: 110, tad: 70 },
        vitalSeries: {
          tas: [{ value: 110, time: '00:00' }],
          tad: [{ value: 70, time: '00:00' }],
        },
        glucometrias: [],
        io: {},
      },
      {
        id: '2',
        recordedAt,
        vitals: {},
        vitalSeries: {
          tas: [
            { value: 120, time: '00:00' },
            { value: 130, time: '00:00' },
          ],
          tad: [
            { value: 75, time: '00:00' },
            { value: 80, time: '00:00' },
          ],
        },
        glucometrias: [],
        io: {},
      },
    ],
    textoGuardado: { text: '', savedAt: null },
  };
  var snap = deriveSnapshot(monitoreo);
  var html = renderSnapshotVitalsHtml(snap);
  assert.match(html, /ea-snapshot-row-label">T\/A</);
  assert.match(html, /ea-snapshot-row-value">130\/80<\/span>/);
  assert.match(html, /ea-snapshot-row-stamp">26\/06</);
  assert.match(html, /ea-snapshot-row-label">SatO₂</);
  assert.match(html, /ea-snapshot-row--interactive/);
  assert.match(html, /openEaVitalHistoryModal\('bp'\)/);
  assert.doesNotMatch(html, /ea-snapshot-vital-prior/);
  assert.doesNotMatch(html, /ea-snapshot-row-label">TAS</);
  assert.doesNotMatch(html, /ea-snapshot-row-label">TAD</);
  assert.doesNotMatch(html, /@ 00:00/);
  assert.doesNotMatch(html, />00:00</);
});

test('renderSnapshotVitalsHtml — muestra dd/mm HH:mm cuando hay hora clínica', () => {
  /** @type {any} */
  var snap = {
    vitals: { temp: 38.2 },
    alteredAt: { temp: '14:30' },
    vitalSeries: {
      temp: [{ value: 36, recordedAt: new Date(2026, 5, 22, 6, 0, 0).toISOString() }, { value: 38.2, time: '14:30', recordedAt: new Date(2026, 5, 22, 6, 0, 0).toISOString() }],
    },
  };
  var html = renderSnapshotVitalsHtml(snap);
  assert.match(html, /ea-snapshot-row-value">38\.2<\/span>/);
  assert.match(html, /ea-snapshot-row-stamp">22\/06 14:30</);
  assert.match(html, /ea-snapshot-row--altered/);
});

test('vitalHasHistory y historial modal — FC con lecturas previas', () => {
  /** @type {any} */
  var snap = {
    vitals: { fc: 98 },
    vitalSeries: {
      fc: [
        { value: 103, recordedAt: new Date(2026, 5, 25, 0, 0, 0).toISOString() },
        { value: 100, recordedAt: new Date(2026, 5, 25, 0, 0, 0).toISOString() },
        { value: 98, recordedAt: new Date(2026, 5, 25, 0, 0, 0).toISOString() },
      ],
    },
  };
  assert.equal(vitalHasHistory('fc', snap), true);
  var entries = getVitalHistoryEntries('fc', snap);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].value, '98');
  var listHtml = renderVitalHistoryListHtml(entries);
  assert.match(listHtml, /ea-vital-history-metric/);
  assert.match(listHtml, /ea-vital-history-badge">Actual</);
  assert.match(listHtml, />98</);
  assert.match(listHtml, />103</);
});
