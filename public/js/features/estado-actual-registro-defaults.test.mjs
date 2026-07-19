import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultRegistroRecordedAt,
  getGlucometriaRegistroWindow,
  collectGlucometriasForRegistroWindow,
  gluPointMs,
  sortGlucometriasChronologically,
  STANDARD_GLUCOMETRIA_TIMES,
  vitalAlteredTimeForDisplay,
  isTurnCloseHm,
  formatEaVitalPointShorthand,
  formatEaVitalStampForSnapshot,
} from './estado-actual-registro-defaults.mjs';

describe('estado-actual-registro-defaults', () => {
  it('vitalAlteredTimeForDisplay omits turn-close 00:00', () => {
    assert.equal(vitalAlteredTimeForDisplay('00:00'), '');
    assert.equal(vitalAlteredTimeForDisplay('08:15'), '08:15');
    assert.equal(isTurnCloseHm('00:00'), true);
  });

  it('formatEaVitalStampForSnapshot — solo fecha en cierre de turno', () => {
    var cierre = new Date(2026, 5, 26, 0, 0, 0).toISOString();
    assert.equal(formatEaVitalStampForSnapshot(cierre, '00:00'), '26/06');
    assert.equal(formatEaVitalStampForSnapshot(cierre, ''), '26/06');
  });

  it('formatEaVitalPointShorthand — dd/mm HH:mm local', () => {
    var recordedAt = new Date(2026, 4, 25, 12, 39, 0).toISOString();
    assert.equal(formatEaVitalPointShorthand(recordedAt, '08:15'), '25/05 08:15');
    var cierre = new Date(2026, 5, 26, 0, 0, 0).toISOString();
    assert.equal(formatEaVitalPointShorthand(cierre, '00:00'), '26/06 00:00');
  });

  it('STANDARD_GLUCOMETRIA_TIMES are 08:00, 16:00 (prev day) and 00:00 (current day)', () => {
    assert.deepEqual(STANDARD_GLUCOMETRIA_TIMES, ['08:00', '16:00', '00:00']);
  });

  it('getDefaultRegistroRecordedAt is today at 00:00 local', () => {
    var now = new Date(2026, 4, 27, 14, 30, 0);
    var d = getDefaultRegistroRecordedAt(now);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 4);
    assert.equal(d.getDate(), 27);
    assert.equal(d.getHours(), 0);
    assert.equal(d.getMinutes(), 0);
  });

  it('collectGlucometriasForRegistroWindow keeps glus from yesterday 08:00 until today 00:00', () => {
    var now = new Date(2026, 4, 27, 9, 0, 0);
    var historial = [
      {
        recordedAt: new Date(2026, 4, 26, 7, 0, 0).toISOString(),
        glucometrias: [{ value: 99, time: '07:00' }],
      },
      {
        recordedAt: new Date(2026, 4, 26, 10, 0, 0).toISOString(),
        glucometrias: [{ value: 120, time: '10:00' }],
      },
      {
        recordedAt: new Date(2026, 4, 27, 0, 0, 0).toISOString(),
        glucometrias: [{ value: 180, time: '00:00' }],
      },
      {
        recordedAt: new Date(2026, 4, 27, 8, 0, 0).toISOString(),
        glucometrias: [{ value: 200, time: '08:00' }],
      },
    ];
    var glus = collectGlucometriasForRegistroWindow(historial, now);
    assert.deepEqual(
      glus.map(function (g) {
        return g.value + '@' + g.time;
      }),
      ['120@10:00', '180@00:00']
    );
    var win = getGlucometriaRegistroWindow(now);
    assert.equal(win.start.getHours(), 8);
    assert.equal(win.end.getHours(), 0);
    assert.equal(win.end.getDate(), 27);
  });

  it('collectGlucometriasForRegistroWindow keeps turn-close 08/16 as previous day and drops post-midnight extras', () => {
    var now = new Date(2026, 4, 28, 8, 39, 0);
    var historial = [
      {
        recordedAt: new Date(2026, 4, 27, 17, 20, 0).toISOString(),
        glucometrias: [
          { value: 190, time: '08:00' },
          { value: 280, time: '10:00' },
          { value: 221, time: '16:00' },
          { value: 136, time: '20:00' },
        ],
      },
      {
        recordedAt: new Date(2026, 4, 28, 0, 0, 0).toISOString(),
        glucometrias: [
          { value: 159, time: '00:00' },
          { value: 135, time: '08:00' },
          { value: 191, time: '12:00' },
          { value: 194, time: '16:00' },
        ],
      },
    ];
    var glus = collectGlucometriasForRegistroWindow(historial, now);
    assert.deepEqual(
      glus.map(function (g) {
        return g.value + '@' + g.time;
      }),
      ['135@08:00', '190@08:00', '280@10:00', '194@16:00', '221@16:00', '136@20:00', '159@00:00']
    );
  });

  it('gluPointMs maps 08:00 and 16:00 to previous day on turn-close rows', () => {
    var recordedAt = new Date(2026, 5, 20, 0, 0, 0).toISOString();
    var ms0800 = gluPointMs(recordedAt, '08:00');
    var ms1600 = gluPointMs(recordedAt, '16:00');
    var ms0000 = gluPointMs(recordedAt, '00:00');
    var ms0400 = gluPointMs(recordedAt, '04:00');
    assert.equal(new Date(ms0800).getDate(), 19);
    assert.equal(new Date(ms1600).getDate(), 19);
    assert.equal(new Date(ms0000).getDate(), 20);
    assert.equal(new Date(ms0400).getDate(), 20);
    assert.ok(ms0800 < ms1600 && ms1600 < ms0000 && ms0000 < ms0400);
  });

  it('sortGlucometriasChronologically orders turn-close glucometrias by time', () => {
    var recordedAt = new Date(2026, 5, 20, 0, 0, 0).toISOString();
    var sorted = sortGlucometriasChronologically(
      [
        { value: 171, time: '08:00' },
        { value: 125, time: '16:00' },
        { value: 243, time: '00:00' },
        { value: 110, time: '04:00' },
      ],
      recordedAt
    );
    assert.deepEqual(
      sorted.map(function (g) {
        return g.value + '@' + g.time;
      }),
      ['171@08:00', '125@16:00', '243@00:00', '110@04:00']
    );
  });
});
