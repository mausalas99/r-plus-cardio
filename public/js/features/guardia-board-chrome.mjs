/**
 * Modo Guardia — chrome, bootstrap, and census summary helpers.
 */
import { storage } from '../storage.js';
import { isGuardiaMode } from './chrome.mjs';
import { clinicalSessionContext, mapPatientForGuardiaGrid } from '../clinical-access-runtime.mjs';
import { userIsOnGuardiaCallToday } from '../clinico-access.mjs';
import { effectiveClinicalRank, hasElevatedTeamPrivileges } from '../clinical-privileges.mjs';
import { setGuardiaMode, syncGuardiaModeUI, toggleGuardiaMode } from '../guardia-mode-sync.mjs';
import { diagnosticosTextForCenso } from '../patient-diagnosticos.mjs';
import { vitalsBannerForGuardia } from './unified-patient-grid-board.mjs';
import { getEntregaPhase, openEntregaModal, toggleEntregaPhase } from './clinical-entrega.mjs';
import { mergeSalaGuardiaTodayRows } from './guardia-hoy-modal.mjs';
import { isEntregaRosterOpen } from './entrega-roster-panel.mjs';
import { ensureTeamAssignedPatientsOnDevice, refreshGuardiaCensusFromDb } from '../clinical-access-runtime.mjs';
import { syncGuardiaPhaseBar } from './guardia-phase-bar.mjs';
import { entregaChipMarkerIds } from '../../../lib/entrega/entrega-chip-markers.mjs';
import {
  listActiveProcedimientos,
  normalizePendientesJson,
} from '../../../lib/entrega/entrega-pendientes.mjs';
import { vitalsStructuredMonitoringEnabled } from '../../../lib/entrega/entrega-vitals-plan.mjs';
import { isGuardiaChipCritical } from '../../../lib/entrega/guardia-chip-critical.mjs';
import { wireGuardiaPatientActionSheetDismiss } from './guardia-patient-action-sheet.mjs';
import { renderGuardiaBoard } from './guardia-board-render.mjs';
import {
  isAppShellInstalled,
  isEntregaClickBusy,
  isEntregaControlsInstalled,
  markAppShellInstalled,
  markEntregaControlsInstalled,
  setEntregaClickBusy,
} from './guardia-board-state.mjs';

export function resolveGuardiaGridRank(user) {
  if (hasElevatedTeamPrivileges(user)) return 'R4';
  const raw = String(user?.rank || '').trim();
  if (raw === 'R4') return 'R4';
  return effectiveClinicalRank(user);
}

/** @param {Record<string, unknown>|null|undefined} settings */
export async function bootstrapGuardiaViewOnEnter(settings) {
  const userId = String(clinicalSessionContext.user?.user_id || '');
  if (!userId) return;

  const teams = clinicalSessionContext.teams || [];
  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const now = new Date();
  const salaGuardiaToday = mergeSalaGuardiaTodayRows(
    teams,
    clinicalSessionContext.salaGuardiaToday || []
  );
  const onCallReceiver = userIsOnGuardiaCallToday(
    userId,
    rank,
    teams,
    now,
    salaGuardiaToday
  );

  if (onCallReceiver) {
    setGuardiaMode(true, { settings, renderGuardiaBoard, rerenderBoard: true });
  }
}

/** Pull guardia census + missing ward patients when entering modo guardia. */
export async function bootstrapGuardiaCensusData(settings) {
  await refreshGuardiaCensusFromDb(settings);
  await ensureTeamAssignedPatientsOnDevice({ allowLanPull: true, lanPullDelayMs: 3000 });
  if (isGuardiaMode()) renderGuardiaBoard(settings);
}

/** @returns {Record<string, unknown>|null} */
export function guardiaBoardSettings() {
  try {
    if (typeof window !== 'undefined' && typeof window.loadSettings === 'function') {
      return window.loadSettings();
    }
  } catch (_e) { void _e; }
  return null;
}

export function handleEntregaPhaseButtonClick() {
  if (isEntregaClickBusy()) return;
  setEntregaClickBusy(true);
  void (async () => {
    try {
      await toggleEntregaPhase({
        settings: guardiaBoardSettings(),
        renderGuardiaBoard,
      });
      syncEntregaPhaseChrome();
    } finally {
      setEntregaClickBusy(false);
    }
  })();
}

export function installGuardiaEntregaControls() {
  if (isEntregaControlsInstalled() || typeof document === 'undefined') return;
  markEntregaControlsInstalled();

  if (typeof window !== 'undefined') {
    window.appShell = window.appShell || {};
    window.appShell.toggleEntregaPhase = handleEntregaPhaseButtonClick;
  }

  syncEntregaPhaseChrome();
}

export function installGuardiaAppShell() {
  if (isAppShellInstalled() || typeof window === 'undefined') return;
  markAppShellInstalled();
  wireGuardiaPatientActionSheetDismiss();
  installGuardiaEntregaControls();
  window.appShell = window.appShell || {};
  window.appShell.openEntregaModal = openEntregaModal;
  window.appShell.toggleEntregaPhase = handleEntregaPhaseButtonClick;
  window.addEventListener('guardia:turno-activo', () => {
    renderGuardiaBoard(null);
  });
  window.addEventListener('guardia:entrega-ended', () => {
    syncEntregaPhaseChrome();
    renderGuardiaBoard(null);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installGuardiaEntregaControls, { once: true });
  } else {
    installGuardiaEntregaControls();
  }
}

export function syncEntregaPhaseChrome(opts = {}) {
  const btn = document.getElementById('btn-guardia-entrega-phase');
  const status = document.getElementById('guardia-entrega-phase-status');
  const phase = getEntregaPhase();
  const active = !!phase?.active;
  const rosterOpen = opts.rosterOpen ?? isEntregaRosterOpen();

  if (btn) {
    btn.hidden = !!rosterOpen;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.textContent = 'Entrega';
    btn.title = active
      ? 'Continuar entrega — listado de pacientes'
      : opts.turnoActivo
        ? 'Documentar entrega — abre el listado por paciente'
        : 'Iniciar entrega al R1 de guardia de tu sala';
  }

  if (status) {
    if (active && phase?.coveringLabel && !rosterOpen) {
      status.hidden = false;
      status.textContent = `Entregando a ${phase.coveringLabel} · pulsa Entrega para abrir el listado`;
    } else {
      status.hidden = true;
      status.textContent = '';
    }
  }
}

/** @param {Record<string, unknown>|null|undefined} _settings */
export function wireGuardiaEntregaPhaseButton(_settings) {
  installGuardiaEntregaControls();
  const btn = document.getElementById('btn-guardia-entrega-phase');
  if (!btn || btn._guardiaEntregaWired) return;
  btn._guardiaEntregaWired = true;
  btn.addEventListener('click', () => handleEntregaPhaseButtonClick());
  syncEntregaPhaseChrome();
}

/** @param {string} pid */
export function pendingTodoCount(pid) {
  return storage.getTodos(pid).filter((t) => !t.completed).length;
}

/** @param {string} pid */
export function labsSnippetForPatient(pid) {
  const history = storage.getLabHistory();
  const rows = Array.isArray(history[pid]) ? history[pid] : [];
  if (!rows.length) return '—';
  const last = rows[rows.length - 1];
  const text = String(last?.text || last?.raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '—';
  const line = text.split('\n').find((l) => /★|crit|alter|↑|↓/i.test(l)) || text.split('\n')[0] || text;
  return line.slice(0, 48);
}

/**
 * @param {Record<string, unknown>} p
 * @param {Map<string, object>} guardiasMap
 */
export function enrichPatientForGuardiaCard(p, guardiasMap) {
  const base = mapPatientForGuardiaGrid(p);
  const g = guardiasMap.get(base.id);
  const dxList = Array.isArray(p.diagnosticosList) ? p.diagnosticosList : [];
  const dxText =
    diagnosticosTextForCenso(dxList, { max: 2 }) ||
    String(p.diagnosticosText || p.motivo || '').trim() ||
    'Sin diagnóstico registrado';
  const pendingCount = g?.pendientes_json
    ? listActiveProcedimientos(normalizePendientesJson(g.pendientes_json)).length
    : 0;
  const isCritical = isGuardiaChipCritical(g);
  const entregaMarkers = g ? entregaChipMarkerIds(g) : [];
  return {
    ...base,
    dxText: dxText.toUpperCase(),
    pendingCount,
    labsSnippet: labsSnippetForPatient(base.id),
    isCritical,
    entregaMarkers,
    guardiaMeta: g,
  };
}

/**
 * @param {Array<ReturnType<typeof enrichPatientForGuardiaCard>>} censusPatients
 * @param {Map<string, object>} guardiasMap
 */
export function computeGuardiaSummary(censusPatients, guardiasMap) {
  let critical = 0;
  let pending = 0;
  let vitalsMonitored = 0;
  let vitalsOverdue = 0;
  let vitalsDueSoon = 0;
  censusPatients.forEach((p) => {
    const meta = guardiasMap.get(p.id) || p.guardiaMeta || {};
    if (p.isCritical) critical += 1;
    pending += p.pendingCount || 0;
    const doc = normalizePendientesJson(meta?.pendientes_json);
    if (vitalsStructuredMonitoringEnabled(doc.vitalsPlan)) vitalsMonitored += 1;
    const banner = vitalsBannerForGuardia(meta);
    if (banner.cls === 'breached') vitalsOverdue += 1;
    else if (banner.cls === 'warning') vitalsDueSoon += 1;
  });
  return {
    total: censusPatients.length,
    critical,
    pending,
    vitalsMonitored,
    vitalsOverdue,
    vitalsDueSoon,
  };
}

/**
 * @param {ReturnType<typeof computeGuardiaSummary>} summary
 * @param {{ turnoActivo?: boolean }} opts
 */
export function renderGuardiaSummaryTiles(summary, opts = {}) {
  const host = document.getElementById('guardia-summary');
  if (!host) return;

  const vitalsTitle =
    summary.vitalsMonitored > 0
      ? `${summary.vitalsMonitored} con monitoreo de signos` +
        (summary.vitalsOverdue > 0
          ? ` · ${summary.vitalsOverdue} vencido${summary.vitalsOverdue === 1 ? '' : 's'}`
          : summary.vitalsDueSoon > 0
            ? ` · ${summary.vitalsDueSoon} pronto`
            : '')
      : 'Sin plan de signos en entregas guardadas';

  const stats = [
    {
      value: summary.total,
      label: 'censo',
      title: opts.turnoActivo ? 'En censo — turno activo' : 'En censo — tu alcance',
    },
    {
      value: summary.critical,
      label: 'críticos',
      hot: summary.critical > 0,
      title: 'Críticos — revisar primero',
    },
    {
      value: summary.vitalsMonitored || 0,
      label: 'signos',
      hot: summary.vitalsOverdue > 0,
      warn: !summary.vitalsOverdue && summary.vitalsDueSoon > 0,
      title: vitalsTitle,
    },
    {
      value: summary.pending,
      label: 'estudios',
      title: 'Estudios pendientes de entrega',
    },
  ];

  host.innerHTML = stats
    .map((stat, index) => {
      const classes = ['guardia-stat'];
      if (stat.hot) classes.push('guardia-stat--hot');
      else if (stat.warn) classes.push('guardia-stat--warn');
      const sep =
        index > 0 ? '<span class="guardia-stat-sep" aria-hidden="true">·</span>' : '';
      return `${sep}<div class="${classes.join(' ')}" title="${stat.title}"><span class="guardia-stat-value">${stat.value}</span><span class="guardia-stat-label">${stat.label}</span></div>`;
    })
    .join('');
}

/**
 * @param {number} count
 * @param {{ turnoActivo: boolean, entregaActive: boolean, vitalsOverdue: number, critical: number }} state
 */
export function renderGuardiaCensusHead(count, state) {
  const host = document.getElementById('guardia-census-head');
  if (!host) return;

  const parts = [];
  if (state.critical > 0) parts.push(`${state.critical} crítico${state.critical === 1 ? '' : 's'}`);
  if (state.vitalsOverdue > 0) {
    parts.push(`${state.vitalsOverdue} signo${state.vitalsOverdue === 1 ? '' : 's'} vencido${state.vitalsOverdue === 1 ? '' : 's'}`);
  }
  const sortHint = parts.length
    ? `${parts.join(' · ')} arriba · por cama`
    : 'Orden por cama · críticos e inestables arriba';

  host.innerHTML = `
    <div class="guardia-census-head-inner">
      <h2 class="guardia-section-title">Pacientes <span class="guardia-census-count">${count}</span></h2>
      <p class="guardia-section-sub">${sortHint}</p>
    </div>`;
  appendGuardiaLearnNudge(host);
}

export function appendGuardiaLearnNudge(host) {
  void Promise.all([
    import('../guardia-v7-progress.mjs'),
    import('./settings-help/learn-hub.mjs'),
  ]).then(function (mods) {
    const progressMod = mods[0];
    const hubMod = mods[1];
    if (progressMod.isGuardiaV7TrackComplete()) return;
    const inner = host.querySelector('.guardia-census-head-inner');
    if (!inner || inner.querySelector('.guardia-learn-nudge-btn')) return;
    const summary = progressMod.guardiaV7ProgressSummary();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-med-secondary guardia-learn-nudge-btn';
    btn.textContent = `Guía guardia ${summary.completed}/${summary.total}`;
    btn.title = 'Abrir capítulos de guardia en el Centro de aprendizaje';
    btn.addEventListener('click', function () {
      if (typeof hubMod.openLearnHub === 'function') {
        hubMod.openLearnHub({ focusTrack: 'guardia-v7' });
      }
    });
    inner.appendChild(btn);
  });
}

export function wireGuardiaModeToggle(settings) {
  const btn = document.getElementById('btn-guardia-mode-toggle');
  if (!btn || btn._rpcGuardiaModeWired) return;
  btn._rpcGuardiaModeWired = true;

  syncGuardiaModeUI();

  btn.addEventListener('click', () => {
    toggleGuardiaMode({
      settings,
      renderGuardiaBoard,
    });
  });
}

/**
 * @param {{
 *   turnoActivo: boolean,
 *   entregaActive: boolean,
 *   rosterOpen: boolean,
 *   settings?: Record<string, unknown>|null,
 * }} state
 */
export function syncGuardiaBoardChrome(state) {
  const scroll = document.getElementById('guardia-board-scroll');
  if (scroll) {
    scroll.classList.toggle('guardia-board-scroll--turno', state.turnoActivo);
    scroll.classList.toggle('guardia-board-scroll--roster', state.rosterOpen);
  }

  const filterHint = document.getElementById('guardia-census-filter-hint');
  const scopePanel = document.getElementById('guardia-census-scope');
  const vitalsSection = document.getElementById('guardia-vitals-section');
  const metricsPanel = document.getElementById('guardia-metrics-panel');

  if (metricsPanel) metricsPanel.hidden = !!state.rosterOpen;
  if (vitalsSection) vitalsSection.hidden = !state.turnoActivo || !!state.rosterOpen;

  if (filterHint) {
    const elevated = hasElevatedTeamPrivileges(clinicalSessionContext.user);
    const alcanceOn = !!clinicalSessionContext.guardiaMode;
    filterHint.textContent = alcanceOn
      ? 'Solo pacientes que te entregaron en este turno.'
      : elevated
        ? 'Censo completo del servicio — acota con Filtros censo arriba.'
        : state.turnoActivo
          ? 'Todos los pacientes en tu alcance durante el turno.'
          : 'Todos los pacientes en tu alcance clínico.';
    filterHint.classList.toggle('visually-hidden', !elevated && !alcanceOn);
  }
  if (scopePanel) {
    scopePanel.classList.toggle('guardia-census-scope--narrow', !!clinicalSessionContext.guardiaMode);
  }

  syncEntregaPhaseChrome({ rosterOpen: state.rosterOpen, turnoActivo: state.turnoActivo });

  syncGuardiaPhaseBar({
    ...state,
    onBeginEntrega: handleEntregaPhaseButtonClick,
  });
}
