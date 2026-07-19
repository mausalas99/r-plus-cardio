/**
 * Guardia phase bar — turno activo badge + clock, pre-turno / entrega CTAs.
 */
import {
  activateTurnoActivo,
  deactivateTurnoActivo,
  getTurnoStartedAt,
} from './entrega-roster-panel.mjs';
import { beginEntregaPhaseFlow } from './clinical-entrega.mjs';

const CLOCK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const LIVE_SVG = `<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>`;

/** @type {number|null} */
let clockTimer = null;

/**
 * @param {Date|null} startedAt
 * @returns {string}
 */
function formatTurnoElapsed(startedAt) {
  if (!startedAt) return '—';
  const mins = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function stopTurnoClock() {
  if (clockTimer != null) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

/**
 * @param {HTMLElement|null} clockEl
 */
function startTurnoClock(clockEl) {
  stopTurnoClock();
  if (!clockEl) return;
  const tick = () => {
    clockEl.textContent = formatTurnoElapsed(getTurnoStartedAt());
  };
  tick();
  clockTimer = window.setInterval(tick, 30000);
}

let phaseBarWired = false;

/**
 * @param {{
 *   settings?: Record<string, unknown>|null,
 *   renderGuardiaBoard?: (s: unknown) => void,
 *   onBeginEntrega?: () => void | Promise<void>,
 * }} callbacks
 */
function wireGuardiaPhaseBar(callbacks) {
  if (phaseBarWired || typeof document === 'undefined') return;
  phaseBarWired = true;

  document.addEventListener('click', (ev) => {
    const startTurnoBtn = ev.target?.closest?.('#guardia-btn-iniciar-turno');
    if (startTurnoBtn) {
      ev.preventDefault();
      activateTurnoActivo();
      window.dispatchEvent(new CustomEvent('guardia:turno-activo'));
      return;
    }

    const endTurnoBtn = ev.target?.closest?.('#guardia-btn-finalizar-turno');
    if (endTurnoBtn) {
      ev.preventDefault();
      deactivateTurnoActivo();
      stopTurnoClock();
      callbacks.renderGuardiaBoard?.(callbacks.settings);
      return;
    }

    const entregaBtn = ev.target?.closest?.('#guardia-btn-iniciar-entrega');
    if (entregaBtn) {
      ev.preventDefault();
      if (typeof callbacks.onBeginEntrega === 'function') {
        void callbacks.onBeginEntrega();
        return;
      }
      void beginEntregaPhaseFlow({
        settings: callbacks.settings,
        renderGuardiaBoard: callbacks.renderGuardiaBoard,
      });
    }
  });
}

/**
 * @param {{
 *   turnoActivo: boolean,
 *   entregaActive: boolean,
 *   rosterOpen: boolean,
 *   settings?: Record<string, unknown>|null,
 *   renderGuardiaBoard?: (s: unknown) => void,
 *   onBeginEntrega?: () => void | Promise<void>,
 * }} opts
 */
export function syncGuardiaPhaseBar(opts) {
  wireGuardiaPhaseBar(opts);

  const host = document.getElementById('guardia-phase-bar');
  if (!host) return;

  if (opts.rosterOpen) {
    host.hidden = true;
    host.innerHTML = '';
    stopTurnoClock();
    return;
  }

  if (opts.turnoActivo) {
    host.hidden = false;
    host.className = 'guardia-phase-bar guardia-phase-bar--turno';
    host.innerHTML = `
      <div class="guardia-phase-bar-main">
        <span class="guardia-turno-badge">${LIVE_SVG} Turno activo</span>
        <span class="guardia-turno-clock" id="guardia-turno-clock" title="Tiempo de turno">${CLOCK_SVG}<span class="guardia-turno-clock-value">—</span></span>
      </div>
      <div class="guardia-phase-bar-actions">
        <button type="button" class="btn-guardia-phase-end" id="guardia-btn-finalizar-turno">Finalizar turno</button>
      </div>`;
    startTurnoClock(host.querySelector('#guardia-turno-clock .guardia-turno-clock-value'));
    return;
  }

  stopTurnoClock();

  host.hidden = true;
  host.innerHTML = '';
}

export function teardownGuardiaPhaseBar() {
  stopTurnoClock();
  const host = document.getElementById('guardia-phase-bar');
  if (host) {
    host.hidden = true;
    host.innerHTML = '';
  }
}
