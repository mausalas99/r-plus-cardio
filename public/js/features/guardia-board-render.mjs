/**
 * Modo Guardia — census grid render orchestration.
 */
import { patients } from '../app-state.mjs';
import { isGuardiaMode } from './chrome.mjs';
import {
  buildGuardiasMap,
  clinicalSessionContext,
  getClinicalScopeContextForEvaluate,
  ensureElevatedWardCensusOnDevice,
  refreshGuardiaCensusFromDb,
} from '../clinical-access-runtime.mjs';
import { userIsOnGuardiaCallToday } from '../clinico-access.mjs';
import { effectiveClinicalRank, hasElevatedTeamPrivileges } from '../clinical-privileges.mjs';
import { UnifiedPatientGridBoard } from './unified-patient-grid-board.mjs';
import { syncGuardiaIncomingStrip, syncGuardiaRotationToolbar } from './clinical-rotation.mjs';
import { wireClinicalTeamsControls } from './clinical-teams.mjs';
import { isEntregaPhaseActive, loadGuardiaGridViewContext, openEntregaModal } from './clinical-entrega.mjs';
import { mergeSalaGuardiaTodayRows } from './guardia-hoy-modal.mjs';
import { isEntregaRosterOpen, isTurnoActivo, openEntregaRosterPanel } from './entrega-roster-panel.mjs';
import { teardownGuardiaPhaseBar } from './guardia-phase-bar.mjs';
import { renderGuardiaVitalsFeed } from './guardia-vitals-feed.mjs';
import { syncOrphanEntregasStrip } from '../guardia-orphan-entregas.mjs';
import {
  openGuardiaPatientActionSheet,
  shouldShowGuardiaPatientActionMenu,
} from './guardia-patient-action-sheet.mjs';
import { filterPatientsForGuardiaCensus } from './patients-clinical-filter.mjs';
import { elevatedPatientFilters } from './clinical-census-filters-state.mjs';
import {
  bootstrapGuardiaCensusData,
  bootstrapGuardiaViewOnEnter,
  computeGuardiaSummary,
  enrichPatientForGuardiaCard,
  installGuardiaAppShell,
  renderGuardiaCensusHead,
  renderGuardiaSummaryTiles,
  resolveGuardiaGridRank,
  syncEntregaPhaseChrome,
  syncGuardiaBoardChrome,
  wireGuardiaEntregaPhaseButton,
  wireGuardiaModeToggle,
} from './guardia-board-chrome.mjs';
import {
  getGridBoard,
  isElevatedFullWardPullScheduled,
  isGuardiaViewBootstrapped,
  markElevatedFullWardPullScheduled,
  setGridBoard,
  setGuardiaViewBootstrapped,
} from './guardia-board-state.mjs';

function clearInactiveGuardiaBoard() {
  setGuardiaViewBootstrapped(false);
  teardownGuardiaPhaseBar();
  document.documentElement.classList.remove('guardia-entrega-roster-open');
}

function ensureGuardiaBoardBootstrapped(settings) {
  installGuardiaAppShell();
  void import('./clinical-rotation-entry.mjs').then((mod) => {
    mod.syncClinicalRotationEntryChrome?.();
  });
  if (!isGuardiaViewBootstrapped()) {
    setGuardiaViewBootstrapped(true);
    void bootstrapGuardiaViewOnEnter(settings);
    void bootstrapGuardiaCensusData(settings);
  }
  wireGuardiaEntregaPhaseButton(settings);
  syncEntregaPhaseChrome();
}

function maybeOpenEntregaRoster(settings, entregaActive, turnoActivo) {
  if (!entregaActive || turnoActivo) return;
  const rosterHost = document.getElementById('entrega-roster-panel');
  if (rosterHost && !rosterHost.innerHTML.trim()) {
    openEntregaRosterPanel(settings);
  }
}

function scheduleElevatedWardPullIfNeeded(user) {
  if (
    !hasElevatedTeamPrivileges(user) ||
    elevatedPatientFilters.teamId ||
    isElevatedFullWardPullScheduled()
  ) {
    return;
  }
  markElevatedFullWardPullScheduled();
  void ensureElevatedWardCensusOnDevice({
    allowLanPull: true,
    lanPullDelayMs: 3000,
    teamFilterId: '',
  });
}

function buildGuardiaScopeContext() {
  const now = new Date();
  const salaGuardiaToday = mergeSalaGuardiaTodayRows(
    clinicalSessionContext.teams || [],
    clinicalSessionContext.salaGuardiaToday || []
  );
  const userId = String(clinicalSessionContext.user?.user_id || '');
  const clinicalRank = effectiveClinicalRank(clinicalSessionContext.user);
  const onCallGuardiaReceiver = userIsOnGuardiaCallToday(
    userId,
    clinicalRank,
    clinicalSessionContext.teams || [],
    now,
    salaGuardiaToday
  );
  const baseScope = getClinicalScopeContextForEvaluate();
  clinicalSessionContext.scopeContext = {
    ...baseScope,
    teams: clinicalSessionContext.teams || baseScope.teams,
    guardias: clinicalSessionContext.guardias || baseScope.guardias,
    salaGuardiaToday,
    guardiaMode: clinicalSessionContext.guardiaMode,
    onCallGuardiaReceiver,
    now,
  };
  scheduleElevatedWardPullIfNeeded(clinicalSessionContext.user);
  return { salaGuardiaToday, onCallGuardiaReceiver };
}

function buildGuardiaCensusPatients(guardiasMap, gridViewContext) {
  let scopedPatients = patients.filter((p) => p && p.id && !p.isDemo && !p.archived);
  if (gridViewContext === 'GUARDIA') {
    scopedPatients = filterPatientsForGuardiaCensus(
      scopedPatients,
      clinicalSessionContext.user,
      clinicalSessionContext.scopeContext,
      guardiasMap,
      elevatedPatientFilters
    );
  }
  return scopedPatients.map((p) => enrichPatientForGuardiaCard(p, guardiasMap));
}

function renderGuardiaVitalsIfTurno(turnoActivo, censusPatientIds) {
  if (!turnoActivo) return;
  renderGuardiaVitalsFeed(
    patients.filter((p) => p && p.id && !p.isDemo && !p.archived),
    censusPatientIds
  );
}

function ensureGuardiaGridBoard(gridViewContext) {
  const board = getGridBoard();
  if (!board) {
    setGridBoard(new UnifiedPatientGridBoard('guardia-census-grid', gridViewContext));
    return;
  }
  board.setViewContext(gridViewContext);
}

function wireGuardiaGridBoard({
  censusPatients,
  guardiasMap,
  gridRank,
  gridViewContext,
  turnoActivo,
  entregaActive,
  onCallGuardiaReceiver,
  settings,
}) {
  const board = getGridBoard();
  if (!board) return;
  const showPatientActionMenu = shouldShowGuardiaPatientActionMenu({
    turnoActivo,
    entregaActive,
    onCallGuardiaReceiver,
    gridViewContext,
  });
  board.chipOpensEntrega = !turnoActivo;
  board.chipGuardiaPatientMenu = showPatientActionMenu;
  board.onChipClick = (patientId) => {
    if (!turnoActivo) {
      const guardia = guardiasMap.get(patientId);
      openEntregaModal({
        patientId,
        guardiaId: guardia?.guardia_id,
        onConfirm: () => {
          void refreshGuardiaCensusFromDb(settings);
        },
      });
      return;
    }
    if (showPatientActionMenu) {
      const row = censusPatients.find((p) => String(p.id) === String(patientId));
      openGuardiaPatientActionSheet({
        patientId,
        patientLabel: row?.name ? String(row.name) : undefined,
      });
    }
  };
  board.drawCensusGrid(censusPatients, guardiasMap, gridRank);
  board.startVitalsTicker();
}

export function renderGuardiaBoard(settings) {
  if (!isGuardiaMode()) {
    clearInactiveGuardiaBoard();
    return;
  }
  ensureGuardiaBoardBootstrapped(settings);

  const root = document.getElementById('appcontent-guardia');
  if (!root || root.getAttribute('aria-hidden') === 'true') return;

  const guardiasMap = clinicalSessionContext.guardiasMap.size
    ? clinicalSessionContext.guardiasMap
    : buildGuardiasMap(clinicalSessionContext.guardias);

  const entregaActive = isEntregaPhaseActive();
  const turnoActivo = isTurnoActivo();
  const rosterOpen = isEntregaRosterOpen();
  const gridViewContext = loadGuardiaGridViewContext();

  wireGuardiaModeToggle(settings);
  syncGuardiaRotationToolbar();
  syncGuardiaBoardChrome({
    turnoActivo,
    entregaActive,
    rosterOpen,
    settings,
    renderGuardiaBoard,
  });
  maybeOpenEntregaRoster(settings, entregaActive, turnoActivo);

  buildGuardiaScopeContext();
  const censusPatients = buildGuardiaCensusPatients(guardiasMap, gridViewContext);
  const summary = computeGuardiaSummary(censusPatients, guardiasMap);

  renderGuardiaSummaryTiles(summary, { turnoActivo });
  renderGuardiaCensusHead(censusPatients.length, {
    turnoActivo,
    entregaActive,
    vitalsOverdue: summary.vitalsOverdue,
    critical: summary.critical,
  });
  renderGuardiaVitalsIfTurno(
    turnoActivo,
    censusPatients.map((p) => p.id)
  );

  void syncGuardiaIncomingStrip(settings);
  syncOrphanEntregasStrip(settings);
  wireClinicalTeamsControls();

  ensureGuardiaGridBoard(gridViewContext);
  wireGuardiaGridBoard({
    censusPatients,
    guardiasMap,
    gridRank: resolveGuardiaGridRank(clinicalSessionContext.user),
    gridViewContext,
    turnoActivo,
    entregaActive,
    onCallGuardiaReceiver: clinicalSessionContext.scopeContext?.onCallGuardiaReceiver,
    settings,
  });
}
