import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  vitalSeriesFromMedicion,
  vitalSeriesToLegacyFields,
  MAX_VITAL_READINGS_PER_DAY,
} from './estado-actual-vital-series.mjs';
import { validateVitalSeriesTurnLimits } from './estado-actual-panel-vitals.mjs';

describe('estado-actual-vital-series', () => {
  it('reads up to four readings from vitalSeries', () => {
    var med = {
      vitalSeries: {
        fc: [
          { value: 80, time: '08:00' },
          { value: 90, time: '10:00' },
          { value: 100, time: '12:00' },
          { value: 110, time: '14:00' },
        ],
      },
    };
    var series = vitalSeriesFromMedicion(med);
    assert.equal(series.fc.length, MAX_VITAL_READINGS_PER_DAY);
    assert.equal(series.fc[3].value, 110);
  });

  it('validateVitalSeriesTurnLimits blocks when historial plus new exceed cap', () => {
    var now = new Date(2026, 5, 22, 12, 0, 0);
    var recordedAt = new Date(2026, 5, 22, 0, 0, 0).toISOString();
    var hist = [
      {
        recordedAt: recordedAt,
        vitalSeries: { tas: [{ value: 110 }, { value: 120 }] },
      },
    ];
    var blocked = validateVitalSeriesTurnLimits(
      hist,
      { tas: [{ value: 130 }, { value: 140 }, { value: 150 }] },
      now
    );
    assert.equal(blocked.ok, false);
    var fine = validateVitalSeriesTurnLimits(hist, { tas: [{ value: 130 }, { value: 140 }] }, now);
    assert.equal(fine.ok, true);
  });

  it('maps series to legacy vitals for charts', () => {
    var series = {
      temp: [
        { value: 37.2, time: '08:00' },
        { value: 38.5, time: '14:00' },
      ],
    };
    var leg = vitalSeriesToLegacyFields(series);
    assert.equal(leg.vitals.temp, 38.5);
    assert.equal(leg.vitals.tempPeak, 37.2);
  });

  it('legacy vitals do not duplicate when vitalSeries already has readings', () => {
    var med = {
      vitals: { temp: 36 },
      vitalSeries: {
        temp: [
          { value: 37.2, time: '08:00' },
          { value: 38.5, time: '14:00' },
        ],
      },
    };
    var series = vitalSeriesFromMedicion(med);
    assert.equal(series.temp.length, 2);
    assert.equal(series.temp[1].value, 38.5);
  });
});
