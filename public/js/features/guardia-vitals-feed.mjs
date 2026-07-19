/**
 * Guardia vitals feed — compact horizontal strip of recent vitals during turno activo.
 */
import { abbreviatePatientName } from '../../../lib/interno/interno-board.mjs';
import { getTurnoStartedAt } from './entrega-roster-panel.mjs';

const ALERT_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const VITALS_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

/**
 * @param {Date|string|null|undefined} ts
 * @returns {string}
 */
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return 'ahora';
  if (diff < 60) return `${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * @param {string|Date|null|undefined} ts
 * @param {Date|null} turnoStart
 * @returns {boolean}
 */
function isInTurnoSession(ts, turnoStart) {
  if (!ts || !turnoStart) return true;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) && t >= turnoStart.getTime();
}

/**
 * @param {{ alteredAt?: Record<string, unknown> }} entry
 * @returns {boolean}
 */
function entryHasAlerts(entry) {
  return !!(entry?.alteredAt && Object.keys(entry.alteredAt).length > 0);
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {Record<string, unknown>} [alteredAt]
 * @returns {string}
 */
function fmtVal(key, value, alteredAt = {}) {
  const v = value != null ? String(value) : '—';
  if (alteredAt[key]) return `<span class="vfeed-altered">${v}</span>`;
  return v;
}

/**
 * @param {{ values?: Record<string, unknown>, alteredAt?: Record<string, unknown> }} entry
 * @returns {string}
 */
function medicionRecordedAt(entry) {
  return String(entry?.recordedAt || entry?.registeredAt || entry?.createdAt || '');
}

function medicionVitals(entry) {
  return entry?.vitals && typeof entry.vitals === 'object'
    ? entry.vitals
    : entry?.values && typeof entry.values === 'object'
      ? entry.values
      : {};
}

function patientBedLabel(p) {
  const joined = [p?.cuarto, p?.cama].filter(Boolean).join('-');
  return joined || String(p?.bed_label || '—');
}

function buildVitalsLine(entry) {
  const v = medicionVitals(entry);
  const alt = entry?.alteredAt || {};
  const parts = [];
  if (v.ta != null) parts.push(`TA ${fmtVal('ta', v.ta, alt)}`);
  if (v.fc != null) parts.push(`FC ${fmtVal('fc', v.fc, alt)}`);
  if (v.fr != null) parts.push(`FR ${fmtVal('fr', v.fr, alt)}`);
  if (v.temp != null) parts.push(`T ${fmtVal('temp', v.temp, alt)}`);
  if (v.sat != null) parts.push(`Sat ${fmtVal('sat', v.sat, alt)}`);
  return parts.join(' · ') || '—';
}

/**
 * @param {Array<{ id: string, name?: string, bed_label?: string, monitoreo?: { historial?: Array<{ values?: object, alteredAt?: object, registeredAt?: string, createdAt?: string }> } }>} patients
 * @param {Date|null} turnoStart
 * @returns {Array<{ id: string, bed: string, name: string, line: string, hasAlerts: boolean, registeredAt: string|null }>}
 */
function collectRecentVitals(patients, turnoStart) {
  return patients
    .map((p) => {
      const hist = Array.isArray(p.monitoreo?.historial) ? p.monitoreo.historial : [];
      if (!hist.length) return null;
      const last = hist[hist.length - 1];
      const registeredAt = medicionRecordedAt(last);
      if (!isInTurnoSession(registeredAt, turnoStart)) return null;
      return {
        id: p.id,
        bed: patientBedLabel(p),
        name: abbreviatePatientName(String(p.nombre || p.name || '')),
        line: buildVitalsLine(last),
        hasAlerts: entryHasAlerts(last),
        registeredAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.hasAlerts !== b.hasAlerts) return a.hasAlerts ? -1 : 1;
      return (b.registeredAt || '').localeCompare(a.registeredAt || '');
    });
}

/** @param {string} patientId */
function scrollToPatientChip(patientId) {
  const card = document.querySelector(`.patient-chip-card[data-patient-id="${patientId}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  card.classList.add('patient-chip-card--pulse');
  window.setTimeout(() => card.classList.remove('patient-chip-card--pulse'), 1200);
}

let vitalsFeedWired = false;

function wireVitalsFeedClicks() {
  if (vitalsFeedWired || typeof document === 'undefined') return;
  vitalsFeedWired = true;
  document.addEventListener('click', (ev) => {
    const chip = ev.target?.closest?.('.vfeed-chip[data-patient-id]');
    if (!chip) return;
    scrollToPatientChip(String(chip.getAttribute('data-patient-id') || ''));
  });
}

/**
 * @param {Array<object>} patients
 * @param {string[]} [censusIds] — ids visible in current census (for empty-state copy)
 */
export function renderGuardiaVitalsFeed(patients, censusIds = []) {
  wireVitalsFeedClicks();
  const host = document.getElementById('guardia-vitals-feed');
  if (!host) return;

  const turnoStart = getTurnoStartedAt();
  const items = collectRecentVitals(patients, turnoStart);
  const censusCount = censusIds.length;

  if (!items.length) {
    host.innerHTML = `
      <div class="vfeed-header">
        ${VITALS_SVG}
        <span class="vfeed-title">Signos en este turno</span>
      </div>
      <div class="vfeed-empty" role="status">
        <span class="empty-state-title">Sin registros desde que iniciaste el turno</span>
        ${censusCount ? `<span class="empty-state-lead">${censusCount} paciente${censusCount === 1 ? '' : 's'} en censo — los chips de abajo muestran cuándo toca tomar signos.</span>` : ''}
      </div>`;
    return;
  }

  const chips = items
    .map(
      (item) => `
    <button type="button" class="vfeed-chip${item.hasAlerts ? ' vfeed-chip--alert' : ''}" data-patient-id="${item.id}" title="Ir a ${item.name}">
      <span class="vfeed-chip-bed">Cama ${item.bed}</span>
      <span class="vfeed-chip-name">${item.name}</span>
      <span class="vfeed-chip-vals">${item.line}</span>
      <span class="vfeed-chip-meta">
        ${item.hasAlerts ? `<span class="vfeed-chip-alert">${ALERT_SVG}</span>` : ''}
        <span class="vfeed-chip-time">hace ${timeAgo(item.registeredAt)}</span>
      </span>
    </button>`
    )
    .join('');

  host.innerHTML = `
    <div class="vfeed-header">
      ${VITALS_SVG}
      <span class="vfeed-title">Signos en este turno</span>
      <span class="vfeed-count">${items.length} registro${items.length === 1 ? '' : 's'}</span>
      <span class="vfeed-live-dot" aria-hidden="true" title="Actualización en vivo"></span>
    </div>
    <div class="vfeed-strip" role="list">${chips}</div>
    <p class="vfeed-footnote">Toca un chip para localizar al paciente en el censo.</p>`;
}
