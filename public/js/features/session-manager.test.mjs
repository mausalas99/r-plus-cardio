import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  vitalsIntervalMs,
  vitalsFrequencyNotifyLabel,
  vitalsMonitorAlertState,
  resolvePatientLabelForNotify,
  BackgroundVitalsMonitorLoop,
  ClientSessionInactivityLocker,
} from './session-manager.mjs';

describe('vitalsIntervalMs', () => {
  it('maps frequency strings to milliseconds', () => {
    assert.equal(vitalsIntervalMs('1h'), 3600000);
    assert.equal(vitalsIntervalMs('2h'), 7200000);
    assert.equal(vitalsIntervalMs('Shift_Once'), 8 * 3600000);
    assert.equal(vitalsIntervalMs('unknown'), 4 * 3600000);
  });
});

describe('vitalsFrequencyNotifyLabel', () => {
  it('maps DB enums to readable Spanish labels', () => {
    assert.match(vitalsFrequencyNotifyLabel('1h'), /1 h/);
    assert.match(vitalsFrequencyNotifyLabel('Shift_Once'), /turno/i);
  });
});

describe('resolvePatientLabelForNotify', () => {
  it('prefers resolver over raw patient_id', () => {
    const label = resolvePatientLabelForNotify(
      { patient_id: 'mpwm7dmu' },
      () => 'García López (401-A)'
    );
    assert.equal(label, 'García López (401-A)');
  });
});

describe('vitalsMonitorAlertState', () => {
  it('ignores stale DB frequency when vitalsPlan is routine', () => {
    const state = vitalsMonitorAlertState({
      vitals_frequency: '2h',
      last_vitals_check: new Date(Date.now() - 5 * 3600000).toISOString(),
      pendientes_json: JSON.stringify({
        version: 2,
        vitalsPlan: { frequency: { mode: 'routine' }, metrics: { ta: true, fc: true } },
        items: [],
      }),
    });
    assert.equal(state, null);
  });

  it('requires interval vitalsPlan to alert', () => {
    const state = vitalsMonitorAlertState({
      vitals_frequency: 'None',
      last_vitals_check: new Date(Date.now() - 2 * 3600000).toISOString(),
      pendientes_json: JSON.stringify({
        version: 2,
        vitalsPlan: {
          frequency: { mode: 'interval', hours: 1 },
          metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
        },
        items: [],
      }),
    });
    assert.equal(state?.level, 'overdue');
  });
});

describe('BackgroundVitalsMonitorLoop', () => {
  const activeVitalsPlan = {
    version: 2,
    vitalsPlan: {
      frequency: { mode: 'interval', hours: 1 },
      metrics: { ta: true, fc: true, fr: true, temp: true, sat: true, glu: true },
    },
    items: [],
  };

  it('fires overdue notification when check is breached', async () => {
    const notifications = [];
    const db = {
      all: async () => [
        {
          patient_id: 'pat-1',
          last_vitals_check: new Date(Date.now() - 2 * 3600000).toISOString(),
          vitals_frequency: '1h',
          pendientes_json: JSON.stringify(activeVitalsPlan),
        },
      ],
    };
    const loop = new BackgroundVitalsMonitorLoop(db, 'user-1', {
      notify: (title, body) => notifications.push({ title, body }),
      resolvePatientLabel: () => 'Ana Pérez (12-A)',
    });
    await loop.scan();
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].title, /Overdue/);
    assert.match(notifications[0].body, /Ana Pérez \(12-A\)/);
    assert.doesNotMatch(notifications[0].body, /pat-1/);
  });

  it('skips routine vitalsPlan even when DB frequency is set', async () => {
    const notifications = [];
    const db = {
      all: async () => [
        {
          patient_id: 'pat-1',
          last_vitals_check: new Date(Date.now() - 10 * 3600000).toISOString(),
          vitals_frequency: '2h',
          pendientes_json: JSON.stringify({
            version: 2,
            vitalsPlan: { frequency: { mode: 'routine' }, metrics: { ta: true } },
            items: [],
          }),
        },
      ],
    };
    const loop = new BackgroundVitalsMonitorLoop(db, 'user-1', {
      notify: (title, body) => notifications.push({ title, body }),
    });
    await loop.scan();
    assert.equal(notifications.length, 0);
  });

  it('fires warning when within 15 minutes of due', async () => {
    const notifications = [];
    const db = {
      all: async () => [
        {
          patient_id: 'pat-2',
          last_vitals_check: new Date(Date.now() - (3600000 - 10 * 60000)).toISOString(),
          vitals_frequency: '1h',
          pendientes_json: JSON.stringify(activeVitalsPlan),
        },
      ],
    };
    const loop = new BackgroundVitalsMonitorLoop(db, 'user-1', {
      notify: (title, body) => notifications.push({ title, body }),
    });
    await loop.scan();
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].title, /Warning/);
  });

  it('skips notifications when shouldMonitorVitals is false', async () => {
    const notifications = [];
    const db = {
      all: async () => [
        {
          patient_id: 'pat-off-call',
          last_vitals_check: new Date(Date.now() - 2 * 3600000).toISOString(),
          vitals_frequency: '1h',
          pendientes_json: JSON.stringify(activeVitalsPlan),
        },
      ],
    };
    const loop = new BackgroundVitalsMonitorLoop(db, 'user-1', {
      shouldMonitorVitals: () => false,
      notify: (title, body) => notifications.push({ title, body }),
    });
    await loop.scan();
    assert.equal(notifications.length, 0);
  });

  it('does not repeat the same alert on every scan', async () => {
    const notifications = [];
    const db = {
      all: async () => [
        {
          patient_id: 'pat-3',
          last_vitals_check: new Date(Date.now() - 2 * 3600000).toISOString(),
          vitals_frequency: '1h',
          pendientes_json: JSON.stringify(activeVitalsPlan),
        },
      ],
    };
    const loop = new BackgroundVitalsMonitorLoop(db, 'user-1', {
      notify: (title, body) => notifications.push({ title, body }),
    });
    await loop.scan();
    await loop.scan();
    assert.equal(notifications.length, 1);
  });
});

describe('ClientSessionInactivityLocker', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('clears decrypted key and shows overlay after timeout', () => {
    if (typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.id = 'lock-overlay-test';
    document.body.appendChild(overlay);

    const ctx = { decryptedPrivateKeyPem: 'secret-key' };
    const locker = new ClientSessionInactivityLocker(10, 'lock-overlay-test');
    locker.timeout = 100;
    locker.start(ctx);

    mock.timers.tick(100);

    assert.equal(ctx.decryptedPrivateKeyPem, null);
    assert.ok(overlay.classList.contains('active-lock-view-overlay'));

    locker.stop();
    overlay.remove();
  });
});
