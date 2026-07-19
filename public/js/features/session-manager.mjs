/**
 * Background vitals monitoring and client session inactivity lock.
 */
import { normalizePendientesJson } from '../../../lib/entrega/entrega-pendientes.mjs';
import {
  frequencyDisplayLabel,
  frequencyIntervalMs,
  isVitalsFrequencyPaused,
  normalizeFrequencySpec,
  normalizeVitalsPlan,
  VITALS_METRIC_KEYS,
} from '../../../lib/entrega/entrega-vitals-plan.mjs';

const FREQ_MS = {
  '1h': 3600000,
  '2h': 7200000,
  '4h': 4 * 3600000,
  Shift_Once: 8 * 3600000,
};

/** @param {string} freq */
export function vitalsIntervalMs(freq) {
  return FREQ_MS[freq] ?? 4 * 3600000;
}

/** @param {string} freq DB enum from active_guardias */
export function vitalsFrequencyNotifyLabel(freq) {
  if (!freq || freq === 'None') return 'signos vitales';
  return frequencyDisplayLabel(normalizeFrequencySpec(freq));
}

/**
 * Aligns with guardia board vitals banner: only timed monitoring with active metrics.
 * @param {{ pendientes_json?: string|null, vitals_frequency?: string, last_vitals_check?: string }} row
 * @returns {{ level: 'overdue'|'warning', freqLabel: string }|null}
 */
export function vitalsMonitorAlertState(row) {
  const doc = normalizePendientesJson(row?.pendientes_json);
  const plan = normalizeVitalsPlan(doc.vitalsPlan);
  const hasMetrics = VITALS_METRIC_KEYS.some((k) => plan.metrics[k]);
  if (!hasMetrics) return null;

  const freqSpec = normalizeFrequencySpec(plan.frequency ?? row?.vitals_frequency);
  if (isVitalsFrequencyPaused(freqSpec)) return null;

  const ms = frequencyIntervalMs(freqSpec);
  if (!ms) return null;

  const due = new Date(row?.last_vitals_check || Date.now()).getTime() + ms;
  const diff = due - Date.now();
  const freqLabel = frequencyDisplayLabel(freqSpec);

  if (diff <= 0) return { level: 'overdue', freqLabel };
  if (diff <= 15 * 60000) return { level: 'warning', freqLabel };
  return null;
}

/**
 * @param {{ patient_id?: string }} row
 * @param {(patientId: string, row: object) => string} [resolveLabel]
 */
export function resolvePatientLabelForNotify(row, resolveLabel) {
  const id = String(row?.patient_id || '');
  const resolved =
    typeof resolveLabel === 'function' ? String(resolveLabel(id, row) || '').trim() : '';
  return resolved || id;
}

export class BackgroundVitalsMonitorLoop {
  /**
   * @param {{ all: (sql: string, params?: unknown[]) => Promise<Array<{ patient_id: string, last_vitals_check: string, vitals_frequency: string }>> }} db
   * @param {string} userId
   * @param {{ notify?: (title: string, body: string) => void, intervalMs?: number, resolvePatientLabel?: (patientId: string, row: object) => string }} [opts]
   */
  constructor(db, userId, opts = {}) {
    this.db = db;
    this.userId = userId;
    this.shouldMonitorVitals = opts.shouldMonitorVitals;
    this.resolvePatientLabel = opts.resolvePatientLabel;
    this.notify = opts.notify || ((title, body) => {
      if (typeof Notification !== 'undefined') {
        new Notification(title, { body });
      }
    });
    this.intervalMs = opts.intervalMs ?? 60000;
    /** @type {ReturnType<typeof setInterval>|null} */
    this._timer = null;
    /** @type {Map<string, 'overdue'|'warning'>} */
    this._lastAlertLevel = new Map();
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.scan(), this.intervalMs);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async scan() {
    if (typeof this.shouldMonitorVitals === 'function' && !this.shouldMonitorVitals()) {
      this._lastAlertLevel.clear();
      return;
    }
    const rows = await this.db.all(
      "SELECT patient_id, last_vitals_check, vitals_frequency, pendientes_json FROM active_guardias WHERE covering_user_id = ? AND status = 'Active'",
      [this.userId]
    );
    const seen = new Set();
    rows.forEach((r) => {
      const patientId = String(r.patient_id || '');
      if (!patientId) return;
      seen.add(patientId);

      const alert = vitalsMonitorAlertState(r);
      if (!alert) {
        this._lastAlertLevel.delete(patientId);
        return;
      }
      if (this._lastAlertLevel.get(patientId) === alert.level) return;
      this._lastAlertLevel.set(patientId, alert.level);

      const who = resolvePatientLabelForNotify(r, this.resolvePatientLabel);
      if (alert.level === 'overdue') {
        this.notify(
          'CRITICAL: Overdue',
          `${who}: control de signos (${alert.freqLabel}) vencido.`
        );
      } else {
        this.notify(
          'Warning: Check Soon',
          `${who}: ventana (${alert.freqLabel}) cierra en 15 min.`
        );
      }
    });
    for (const id of this._lastAlertLevel.keys()) {
      if (!seen.has(id)) this._lastAlertLevel.delete(id);
    }
  }
}

export class ClientSessionInactivityLocker {
  /**
   * @param {number} [mins]
   * @param {string} [overlayId]
   */
  constructor(mins = 10, overlayId) {
    this.timeout = mins * 60000;
    this.el = typeof document !== 'undefined' && overlayId ? document.getElementById(overlayId) : null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this.handle = null;
    /** @type {Record<string, unknown>|null} */
    this.ctx = null;
    /** @type {Array<{ event: string, fn: () => void }>} */
    this._listeners = [];
  }

  /** @param {{ decryptedPrivateKeyPem?: string|null }} ctx */
  start(ctx) {
    this.ctx = ctx;
    if (typeof window === 'undefined') return;
    ['mousemove', 'keydown', 'click'].forEach((event) => {
      const fn = () => this.reset();
      window.addEventListener(event, fn);
      this._listeners.push({ event, fn });
    });
    this.reset();
  }

  stop() {
    if (typeof window !== 'undefined') {
      this._listeners.forEach(({ event, fn }) => window.removeEventListener(event, fn));
    }
    this._listeners = [];
    if (this.handle) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }

  reset() {
    if (this.handle) clearTimeout(this.handle);
    this.handle = setTimeout(() => {
      if (this.ctx) this.ctx.decryptedPrivateKeyPem = null;
      if (this.el) this.el.classList.add('active-lock-view-overlay');
    }, this.timeout);
  }
}
