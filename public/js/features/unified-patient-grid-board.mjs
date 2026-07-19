/**
 * High-density Guardia census grid with R4 ward partitioning.
 * Separate from pase-board.mjs (single-patient Pase summary view).
 */
import { calcVitalsBanner, calcVitalsBannerForSpec } from '../../../lib/interno/vitals-banner.mjs';
import {
  R4_GUARDIA_SECTOR_ORDER,
  resolveR4GuardiaSectorLabel,
} from '../clinico-access.mjs';
import { sortPatientsByPriorityThenBed } from '../../../lib/patient-priority-sort.mjs';
import { buildPatientChipInnerHtml, vitalsBannerForGuardia } from './unified-patient-grid-chip-html.mjs';

export { calcVitalsBanner, vitalsBannerForGuardia };

export const R4_FOLLOWUP_PIN_LABEL = 'Interconsultas — Seguimiento';

/** @param {Array<{ interconsult_type?: string, interconsult_status?: string }>} patients */
export function filterR4FollowUpPinPatients(patients) {
  return patients.filter(
    (p) => p.interconsult_type === 'Follow-up' && p.interconsult_status !== 'Resolved'
  );
}

export class UnifiedPatientGridBoard {
  /**
   * @param {string} domGridContainerId
   * @param {'GUARDIA'|'HANDOFF'} [appViewContext]
   */
  constructor(domGridContainerId, appViewContext = 'GUARDIA') {
    this.container = typeof document !== 'undefined' ? document.getElementById(domGridContainerId) : null;
    this.context = appViewContext;
    /** When true, chip tap opens entrega (e.g. Modo Guardia) instead of the patient chart. */
    this.chipOpensEntrega = false;
    /** When true in GUARDIA context, chip tap opens guardia patient menu (expediente / eventualidad). */
    this.chipGuardiaPatientMenu = false;
    /** @type {(patientId: string) => void|null} */
    this.onChipClick = null;
  }

  /**
   * @param {'GUARDIA'|'HANDOFF'} appViewContext
   */
  setViewContext(appViewContext) {
    this.context = appViewContext === 'HANDOFF' ? 'HANDOFF' : 'GUARDIA';
  }

  /**
   * @param {string} patientId
   */
  handleChipClick(patientId) {
    const id = String(patientId || '');
    if (!id) return;
    if (
      this.context === 'HANDOFF' ||
      this.chipOpensEntrega ||
      this.chipGuardiaPatientMenu
    ) {
      if (typeof this.onChipClick === 'function') {
        this.onChipClick(id);
      }
      return;
    }
    const selectFn =
      (typeof window !== 'undefined' && typeof window.selectPatient === 'function'
        ? window.selectPatient
        : null) ||
      (typeof globalThis.selectPatient === 'function' ? globalThis.selectPatient : null);
    if (selectFn) selectFn(id);
  }

  /**
   * @param {Array<{ id: string, bed_label?: string, name?: string, service?: string, sub_area?: string, negativa_maniobras_firmada?: number, dxText?: string, pendingCount?: number, labsSnippet?: string, isCritical?: boolean, guardiaMeta?: object }>} patients
   * @param {Map<string, { is_critical?: number, last_vitals_check?: string, vitals_frequency?: string }>} guardiasMap
   * @param {string} [userRank]
   */
  drawCensusGrid(patients, guardiasMap, userRank = 'R1') {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.container.classList.add('patient-chips-grid', 'patient-chips-grid--guardia');

    if (userRank === 'R4') {
      const followUpPatients = filterR4FollowUpPinPatients(patients);
      const followUpIds = new Set(followUpPatients.map((p) => p.id));
      if (followUpPatients.length > 0) {
        this.appendDivider(R4_FOLLOWUP_PIN_LABEL);
        this.renderBatch(followUpPatients, guardiasMap);
      }

      const assignedIds = new Set(followUpIds);
      for (const sector of R4_GUARDIA_SECTOR_ORDER) {
        const sectorPatients = patients.filter((p) => {
          if (!p?.id || assignedIds.has(p.id)) return false;
          if (resolveR4GuardiaSectorLabel(p) !== sector) return false;
          assignedIds.add(p.id);
          return true;
        });
        if (sectorPatients.length > 0) {
          this.appendDivider(sector);
          this.renderBatch(sectorPatients, guardiasMap);
        }
      }
      const otherPatients = patients.filter((p) => p?.id && !assignedIds.has(p.id));
      if (otherPatients.length > 0) {
        this.appendDivider('Otros');
        this.renderBatch(otherPatients, guardiasMap);
      }
      return;
    }

    this.renderBatch(patients, guardiasMap);
  }

  /**
   * @param {Array<{ id: string }>} patients
   * @param {Map<string, { is_critical?: number, last_vitals_check?: string, vitals_frequency?: string }>} guardiasMap
   */
  renderBatch(patients, guardiasMap) {
    const sorted = sortPatientsByPriorityThenBed(patients, guardiasMap);
    sorted.forEach((p) => {
      if (this.container) {
        this.container.appendChild(this.compileChip(p, guardiasMap.get(p.id)));
      }
    });
  }

  /** @param {string} label */
  appendDivider(label) {
    if (!this.container) return;
    const div = document.createElement('div');
    div.className = 'r4-section-divider';
    div.textContent = label;
    this.container.appendChild(div);
  }

  startVitalsTicker() {
    this.stopVitalsTicker();
    if (!this.container) return;
    this._vitalsTickerId = setInterval(() => {
      if (!this.container) return;
      this.container.querySelectorAll('[data-vitals-spec]').forEach((card) => {
        const specRaw = card.dataset.vitalsSpec;
        const last = card.dataset.vitalsLast || '';
        let spec = null;
        try {
          spec = specRaw ? JSON.parse(specRaw) : null;
        } catch (_e) { void _e; }
        const banner = calcVitalsBannerForSpec(last || null, spec);
        const el = card.querySelector('.patient-chip-vitals');
        if (!el) return;
        const textEl = el.querySelector('.patient-chip-vitals__text');
        if (textEl) textEl.textContent = banner.str;
        el.className = `patient-chip-vitals vitals-banner ${banner.cls}`;
      });
    }, 60_000);
  }

  stopVitalsTicker() {
    if (this._vitalsTickerId != null) {
      clearInterval(this._vitalsTickerId);
      this._vitalsTickerId = null;
    }
  }

  /**
   * @param {{ id: string, bed_label?: string, name?: string, negativa_maniobras_firmada?: number, dxText?: string, pendingCount?: number, labsSnippet?: string, isCritical?: boolean, guardiaMeta?: { last_vitals_check?: string, vitals_frequency?: string, is_critical?: number } }} p
   * @param {{ is_critical?: number, last_vitals_check?: string, vitals_frequency?: string }|undefined} g
   */
  compileChip(p, g) {
    const chip = buildPatientChipInnerHtml(p, g);
    const card = document.createElement('div');
    card.className = 'patient-chip-card' + (chip.critical ? ' priority-critical' : '');
    card.setAttribute('data-patient-id', p.id);
    card.dataset.vitalsSpec = JSON.stringify(chip.vitalsSpec ?? null);
    card.dataset.vitalsLast = chip.vitalsLast;
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.innerHTML = chip.innerHtml;

    card.addEventListener('click', () => {
      this.handleChipClick(p.id);
    });
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this.handleChipClick(p.id);
      }
    });
    return card;
  }
}
