import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  frequencyDisplayLabel,
  frequencyIntervalMs,
  isVitalsFrequencyPaused,
  normalizeFrequencySpec,
  normalizeUntilTime,
  normalizeVitalsPlan,
  vitalsFrequencyForDb,
  enabledVitalsMetricKeys,
  resolveGuardiaVitalsFrequencySpec,
  resolveInternoBoardVitalsPlan,
  vitalsMonitoringEnabled,
  vitalsStructuredMonitoringEnabled,
  vitalsPlanSummary,
} from './entrega-vitals-plan.mjs';
import { calcVitalsBannerForSpec } from '../interno/vitals-banner.mjs';
import { normalizePendientesJson, serializePendientesJson } from './entrega-pendientes.mjs';

describe('normalizeFrequencySpec', () => {
  it('round-trips structured modes', () => {
    assert.deepEqual(normalizeFrequencySpec({ mode: 'routine' }), { mode: 'routine' });
    assert.deepEqual(normalizeFrequencySpec({ mode: 'interval', hours: 3 }), {
      mode: 'interval',
      hours: 3,
    });
    assert.deepEqual(normalizeFrequencySpec({ mode: 'shift', timesPerShift: 2 }), {
      mode: 'shift',
      timesPerShift: 2,
    });
  });

  it('migrates legacy DB enums and strings', () => {
    assert.deepEqual(normalizeFrequencySpec('2h'), { mode: 'interval', hours: 2 });
    assert.deepEqual(normalizeFrequencySpec('Shift_Once'), {
      mode: 'shift',
      timesPerShift: 1,
    });
  });
});

describe('untilTime', () => {
  it('normalizes HH:mm', () => {
    assert.equal(normalizeUntilTime('7:5'), '07:05');
    assert.equal(normalizeUntilTime(''), null);
  });

  it('includes until in display label while frequency is active', () => {
    const evening = new Date('2026-06-02T22:00:00');
    const label = frequencyDisplayLabel(
      { mode: 'interval', hours: 2, untilTime: '07:00' },
      evening
    );
    assert.match(label, /Cada 2 h/);
    assert.match(label, /hasta 07:00/);
  });

  it('shows Finalizado when stop time has passed', () => {
    const morning = new Date('2026-06-03T08:00:00');
    const label = frequencyDisplayLabel(
      { mode: 'interval', hours: 2, untilTime: '07:00' },
      morning
    );
    assert.equal(label, 'Finalizado (07:00)');
  });

  it('night shift: 07:00 stop is next morning when now is evening', () => {
    const evening = new Date('2026-06-02T22:00:00');
    assert.equal(
      isVitalsFrequencyPaused({ mode: 'interval', hours: 2, untilTime: '07:00' }, evening),
      false
    );
    const morning = new Date('2026-06-03T08:00:00');
    assert.equal(
      isVitalsFrequencyPaused({ mode: 'interval', hours: 2, untilTime: '07:00' }, morning),
      true
    );
  });
});

describe('frequencyIntervalMs', () => {
  it('computes custom hour intervals', () => {
    assert.equal(frequencyIntervalMs({ mode: 'interval', hours: 3 }), 3 * 3600000);
    assert.equal(frequencyIntervalMs({ mode: 'routine' }), null);
  });
});

describe('vitalsFrequencyForDb', () => {
  it('maps to CHECK enum when possible', () => {
    assert.equal(vitalsFrequencyForDb({ mode: 'interval', hours: 2 }), '2h');
    assert.equal(vitalsFrequencyForDb({ mode: 'interval', hours: 3 }), 'None');
    assert.equal(vitalsFrequencyForDb({ mode: 'shift', timesPerShift: 2 }), 'Shift_Once');
  });
});

describe('normalizeVitalsPlan', () => {
  it('preserves selected metrics', () => {
    const plan = normalizeVitalsPlan({
      frequency: { mode: 'interval', hours: 2 },
      metrics: { ta: true, fc: false, fr: true, temp: true, sat: true, glu: false },
    });
    assert.equal(plan.frequency.mode, 'interval');
    assert.equal(plan.frequency.hours, 2);
    assert.equal(plan.metrics.fc, false);
  });
});

describe('calcVitalsBannerForSpec', () => {
  it('shows label for routine', () => {
    const b = calcVitalsBannerForSpec(null, { mode: 'routine' });
    assert.match(b.str, /Sin signos/);
    assert.equal(b.cls, 'nominal-gray');
  });

  it('uses interval hours for countdown', () => {
    const past = new Date(Date.now() - 5 * 3600000).toISOString();
    const b = calcVitalsBannerForSpec(past, { mode: 'interval', hours: 2 });
    assert.equal(b.cls, 'breached');
  });
});

describe('resolveInternoBoardVitalsPlan', () => {
  it('enables default metrics when only legacy vitals_frequency is set', () => {
    const doc = normalizePendientesJson({
      version: 2,
      vitalsPlan: {
        frequency: { mode: 'routine' },
        metrics: { ta: false, fc: false, fr: false, temp: false, sat: false, glu: false },
      },
      items: [],
    });
    const plan = resolveInternoBoardVitalsPlan(doc, { vitals_frequency: '2h' });
    assert.equal(vitalsStructuredMonitoringEnabled(plan), true);
    assert.match(vitalsPlanSummary(plan), /TA/);
    assert.match(vitalsPlanSummary(plan), /2 h/);
  });
});

describe('vitalsStructuredMonitoringEnabled', () => {
  it('false for routine even with metrics', () => {
    assert.equal(
      vitalsStructuredMonitoringEnabled({
        frequency: { mode: 'routine' },
        metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
      }),
      false
    );
  });

  it('true for interval or shift with metrics', () => {
    assert.equal(
      vitalsStructuredMonitoringEnabled({
        frequency: { mode: 'interval', hours: 6 },
        metrics: { ta: true, fc: false, fr: false, temp: true, sat: true, glu: false },
      }),
      true
    );
    assert.equal(
      vitalsStructuredMonitoringEnabled({
        frequency: { mode: 'shift', timesPerShift: 1 },
        metrics: { ta: true, fc: false, fr: false, temp: false, sat: false, glu: false },
      }),
      true
    );
  });
});

describe('resolveInternoBoardVitalsPlan', () => {
  it('keeps explicit routine in v2 doc even when legacy column has frequency', () => {
    const raw = serializePendientesJson({
      version: 2,
      vitalsPlan: {
        frequency: { mode: 'routine' },
        metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
      },
      items: [],
    });
    const doc = normalizePendientesJson(raw);
    const plan = resolveInternoBoardVitalsPlan(doc, {
      vitals_frequency: '2h',
      pendientes_json: raw,
    });
    assert.equal(plan.frequency.mode, 'routine');
    assert.equal(vitalsStructuredMonitoringEnabled(plan), false);
  });
});

describe('resolveGuardiaVitalsFrequencySpec', () => {
  it('uses legacy DB column when plan frequency is routine', () => {
    const spec = resolveGuardiaVitalsFrequencySpec(
      { frequency: { mode: 'routine' }, metrics: { ta: true } },
      '2h'
    );
    assert.equal(spec.mode, 'interval');
    assert.equal(spec.hours, 2);
  });

  it('prefers structured plan over legacy column', () => {
    const spec = resolveGuardiaVitalsFrequencySpec(
      { frequency: { mode: 'interval', hours: 4 }, metrics: { ta: true } },
      '2h'
    );
    assert.equal(spec.hours, 4);
  });
});

describe('enabledVitalsMetricKeys', () => {
  it('returns enabled metric keys in stable order', () => {
    assert.deepEqual(
      enabledVitalsMetricKeys({
        frequency: { mode: 'routine' },
        metrics: { ta: true, fc: false, fr: true, temp: false, sat: false, glu: true },
      }),
      ['ta', 'fr', 'glu']
    );
  });
});

describe('vitalsMonitoringEnabled', () => {
  it('true when at least one metric is enabled', () => {
    assert.equal(
      vitalsMonitoringEnabled({
        frequency: { mode: 'interval', hours: 2 },
        metrics: { ta: true, fc: false, fr: false, temp: false, sat: false, glu: false },
      }),
      true
    );
    assert.equal(
      vitalsMonitoringEnabled({
        frequency: { mode: 'routine' },
        metrics: { ta: false, fc: false, fr: false, temp: false, sat: false, glu: false },
      }),
      false
    );
  });
});

describe('pendientes vitalsPlan', () => {
  it('round-trips structured frequency in v2 doc', () => {
    const raw = serializePendientesJson({
      version: 2,
      vitalsPlan: {
        frequency: { mode: 'interval', hours: 4 },
        metrics: { ta: true, fc: true, fr: false, temp: true, sat: true, glu: true },
      },
      items: [],
    });
    const doc = normalizePendientesJson(raw);
    assert.equal(doc.vitalsPlan.frequency.hours, 4);
    assert.match(vitalsPlanSummary(doc.vitalsPlan), /4 h/);
    assert.equal(frequencyDisplayLabel(doc.vitalsPlan.frequency), 'Cada 4 h');
  });
});
