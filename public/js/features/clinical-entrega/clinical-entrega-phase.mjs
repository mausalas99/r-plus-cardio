// Entrega phase (handoff turn) lifecycle
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import {
  getJoinedTeams,
  salaOnCallR1,
} from '../../clinico-access.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import { ensureGuardiaHoyBeforeEntrega, mergeSalaGuardiaTodayRows } from '../guardia-hoy-modal.mjs';
import {
  openEntregaRosterPanel,
  closeEntregaRosterPanel,
  isEntregaRosterOpen,
} from '../entrega-roster-panel.mjs';
import {
  normalizeUsers,
  userOptionLabel,
  toast,
  setEntregaToolbarStatus,
} from './clinical-entrega-util.mjs';
import { collectEntregaScopeUsers } from './clinical-entrega-targets.mjs';
import { GUARDIA_GRID_MODE_KEY, ENTREGA_PHASE_KEY } from './clinical-entrega-constants.mjs';
import { resolveActivatorEntregaCovering } from './clinical-entrega-phase-helpers.mjs';

export function resolveR1GuardiaCovering(
  teams,
  users,
  sala,
  now = new Date(),
  salaGuardiaToday = [],
  preferredUserId = ''
) {
  const salaNorm = String(sala || '').trim();
  if (!salaNorm) return null;
  const onCall = salaOnCallR1(teams, salaNorm, now, salaGuardiaToday);
  if (!onCall.length) return null;
  const pref = String(preferredUserId || '');
  const pick = (pref && onCall.find((r) => String(r.user_id) === pref)) || onCall[0];
  const u = normalizeUsers(users).find((x) => x.user_id === String(pick.user_id));
  return {
    coveringUserId: String(pick.user_id),
    teamId: String(pick.team_id || ''),
    sala: salaNorm,
    coveringLabel: u ? userOptionLabel(u) : String(pick.user_id),
  };
}

/**
 * Covering R1 when entrega phase starts — activator when they declared / are on guardia.
 * @param {{
 *   userId: string,
 *   rank?: string,
 *   users: object[],
 *   teams: object[],
 *   sala: string,
 *   salaGuardiaToday?: object[],
 *   guardiaActivated?: boolean,
 *   guardiaMode?: boolean,
 *   now?: Date|string,
 * }} opts
 */
export function resolveEntregaPhaseCovering(opts) {
  const activatorCovering = resolveActivatorEntregaCovering(opts);
  if (activatorCovering) return activatorCovering;

  const userId = String(opts.userId || '');
  const teams = opts.teams || [];
  const users = opts.users || [];
  const sala = String(opts.sala || '').trim();
  const salaGuardiaToday = opts.salaGuardiaToday || [];
  const now = opts.now ? new Date(opts.now) : new Date();
  return resolveR1GuardiaCovering(teams, users, sala, now, salaGuardiaToday, userId);
}

/** @param {object[]} teams @param {string} userId */
export function resolveUserSalaForEntrega(teams, userId) {
  const fromProfile = String(clinicalSessionContext.user?.sala || '').trim();
  if (fromProfile) return fromProfile;
  const joined = getJoinedTeams(teams || [], userId);
  for (const t of joined) {
    const sala = String(t.sala || '').trim();
    if (sala) return sala;
  }
  return '';
}

/**
 * @returns {{ active: boolean, coveringUserId?: string, sala?: string, coveringLabel?: string }|null}
 */
export function getEntregaPhase() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ENTREGA_PHASE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.active) return o;
  } catch (_e) { void _e; }
  return null;
}

export function isEntregaPhaseActive() {
  return !!getEntregaPhase()?.active;
}

/** @returns {string} */
export function getEntregaPhaseCoveringUserId() {
  return String(getEntregaPhase()?.coveringUserId || '');
}

/**
 * @param {{ coveringUserId: string, sala: string, coveringLabel?: string, teamId?: string }} covering
 */
export function startEntregaPhase(covering) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(GUARDIA_GRID_MODE_KEY);
    localStorage.setItem(
      ENTREGA_PHASE_KEY,
      JSON.stringify({
        active: true,
        coveringUserId: String(covering.coveringUserId || ''),
        sala: String(covering.sala || ''),
        coveringLabel: String(covering.coveringLabel || ''),
        teamId: String(covering.teamId || ''),
        startedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* ignore quota */
  }
}

export function endEntregaPhase() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(ENTREGA_PHASE_KEY);
    localStorage.removeItem(GUARDIA_GRID_MODE_KEY);
  } catch (_e) { void _e; }
}

/**
 * @param {{ settings?: Record<string, unknown>|null, renderGuardiaBoard?: (s: unknown) => void }} opts
 */
export function endEntregaPhaseFlow(opts = {}) {
  endEntregaPhase();
  closeEntregaRosterPanel();
  setEntregaToolbarStatus('');
  toast('Fase de entrega finalizada.', 'info');
  opts.renderGuardiaBoard?.(opts.settings);
  return { active: false };
}

/** @param {{ settings?: Record<string, unknown>|null, renderGuardiaBoard?: (s: unknown) => void }} opts */
async function prepareEntregaPhaseCovering_(_opts) {
  const ctx = clinicalSessionContext.scopeContext || {};
  const teams = clinicalSessionContext.teams || ctx.teams || [];
  const userId = String(clinicalSessionContext.user?.user_id || '');
  const sala = resolveUserSalaForEntrega(teams, userId);
  if (!sala) {
    const msg = 'Indica tu Sala en el perfil clínico o únete a un equipo de Sala.';
    setEntregaToolbarStatus(msg, true);
    toast(msg, 'error');
    return null;
  }

  const salaGuardiaToday = mergeSalaGuardiaTodayRows(
    teams,
    ctx.salaGuardiaToday || clinicalSessionContext.salaGuardiaToday || []
  );
  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const guardiaProceed = await ensureGuardiaHoyBeforeEntrega({
    teams,
    sala,
    userId,
    rank,
    salaGuardiaToday,
  });
  if (!guardiaProceed?.proceed) return null;

  const users = collectEntregaScopeUsers(ctx, teams, clinicalSessionContext.user);
  const freshTeams = clinicalSessionContext.teams || teams;
  const freshSalaGuardia = mergeSalaGuardiaTodayRows(
    freshTeams,
    clinicalSessionContext.salaGuardiaToday || ctx.salaGuardiaToday || []
  );
  const covering = resolveEntregaPhaseCovering({
    userId,
    rank,
    users,
    teams: freshTeams,
    sala,
    salaGuardiaToday: freshSalaGuardia,
    guardiaActivated: !!guardiaProceed.activated,
    guardiaMode: !!clinicalSessionContext.guardiaMode,
  });
  return { sala, covering };
}

/** @param {{ settings?: Record<string, unknown>|null, renderGuardiaBoard?: (s: unknown) => void }} opts */
export async function beginEntregaPhaseFlow(opts = {}) {
  const prepared = await prepareEntregaPhaseCovering_(opts);
  if (!prepared) return { active: false };

  startEntregaPhase(
    prepared.covering || {
      coveringUserId: '',
      teamId: '',
      sala: prepared.sala,
      coveringLabel: '',
    }
  );

  setEntregaToolbarStatus('');
  openEntregaRosterPanel(opts.settings);
  opts.renderGuardiaBoard?.(opts.settings);
  return { active: true, covering: prepared.covering || null };
}

/**
 * @param {{ settings?: Record<string, unknown>|null, renderGuardiaBoard?: (s: unknown) => void, exit?: boolean }} opts
 */
export function toggleEntregaPhase(opts = {}) {
  const wantsExit = opts.exit === true;

  if (isEntregaPhaseActive()) {
    if (wantsExit && isEntregaRosterOpen()) {
      return endEntregaPhaseFlow(opts);
    }
    if (!isEntregaRosterOpen()) {
      openEntregaRosterPanel(opts.settings);
      opts.renderGuardiaBoard?.(opts.settings);
      return { active: true, resumed: true };
    }
    if (wantsExit) {
      return endEntregaPhaseFlow(opts);
    }
  }

  return beginEntregaPhaseFlow(opts);
}

/** @returns {'GUARDIA'|'HANDOFF'} */
export function loadGuardiaGridViewContext() {
  if (isEntregaPhaseActive()) return 'HANDOFF';
  try {
    const mode = String(localStorage.getItem(GUARDIA_GRID_MODE_KEY) || 'censo').toLowerCase();
    if (mode === 'entrega') return 'HANDOFF';
  } catch (_e) { void _e; }
  return 'GUARDIA';
}

/** @deprecated — use toggleEntregaPhase / startEntregaPhase */
export function saveGuardiaGridMode(mode) {
  if (mode === 'entrega') {
    toggleEntregaPhase();
    return;
  }
  endEntregaPhase();
}
