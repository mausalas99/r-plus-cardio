/**
 * Modal — declarar guardia hoy (manual override off-cycle). Barrel.
 */
import {
  clinicalSessionContext,
} from '../clinical-access-runtime.mjs';
import { effectiveClinicalRank } from '../clinical-privileges.mjs';
import {
  activeCycleLetterForDate,
  getJoinedTeams,
  salaOnCallR1,
} from '../clinico-access.mjs';
import { buildGuardiaHoyModalBodyHtml } from './guardia-hoy-modal-render.mjs';
import { bindGuardiaHoyModalActions } from './guardia-hoy-modal-handlers.mjs';

/** @param {object[]} teams @param {Array<{ team_id?: string, user_id?: string }>} salaGuardiaToday */
export function mergeSalaGuardiaTodayRows(teams, salaGuardiaToday) {
  const rows = Array.isArray(salaGuardiaToday) ? salaGuardiaToday.map((r) => ({ ...r })) : [];
  const seen = new Set(rows.map((r) => String(r.team_id || '')));
  for (const t of teams || []) {
    const tid = String(t.team_id || '');
    if (!tid || seen.has(tid)) continue;
    const uid = t?.guardia_today?.user_id;
    if (!uid) continue;
    rows.push({
      team_id: tid,
      user_id: String(uid),
      declared_at: t.guardia_today.declared_at,
    });
    seen.add(tid);
  }
  return rows;
}

function modalBackdrop() {
  return document.getElementById('guardia-hoy-modal-backdrop');
}

/**
 * @param {{
 *   teams: object[],
 *   sala: string,
 *   userId: string,
 *   rank?: string,
 *   salaGuardiaToday?: object[],
 * }} ctx
 */
export function shouldPromptGuardiaHoy(ctx) {
  const sala = String(ctx.sala || '').trim();
  const userId = String(ctx.userId || '');
  if (!sala || !userId) return false;

  const teams = Array.isArray(ctx.teams) ? ctx.teams : [];
  const salaGuardiaToday = mergeSalaGuardiaTodayRows(teams, ctx.salaGuardiaToday);
  const now = new Date();
  const onCall = salaOnCallR1(teams, sala, now, salaGuardiaToday);
  const rank = String(ctx.rank || effectiveClinicalRank(clinicalSessionContext.user) || 'R1');

  if (onCall.length === 0) return true;
  if (rank !== 'R1') return true;

  const joined = getJoinedTeams(teams, userId).filter((t) => String(t.sala || '') === sala);
  const isCovering = onCall.some((r) => String(r.user_id) === userId);
  const hasR1Team = joined.some((t) =>
    (t.members || []).some((m) => String(m.user_id) === userId && m.rank === 'R1')
  );
  if (hasR1Team && !isCovering) return true;

  return false;
}

/**
 * @param {{
 *   teams: object[],
 *   sala: string,
 *   userId: string,
 *   rank?: string,
 *   salaGuardiaToday?: object[],
 * }} ctx
 * @returns {Promise<boolean>}
 */
export function ensureGuardiaHoyBeforeEntrega(ctx) {
  if (!shouldPromptGuardiaHoy(ctx)) {
    return Promise.resolve({ proceed: true, activated: false });
  }
  return openGuardiaHoyModal(ctx).then((res) => ({
    proceed: !!res?.proceed,
    activated: !!res?.activated,
  }));
}

/**
 * @param {{
 *   teams: object[],
 *   sala: string,
 *   userId: string,
 *   rank?: string,
 *   salaGuardiaToday?: object[],
 * }} ctx
 * @returns {Promise<{ proceed: boolean, activated?: boolean }>}
 */
export function openGuardiaHoyModal(ctx) {
  const bd = modalBackdrop();
  const body = document.getElementById('guardia-hoy-modal-body');
  const form = document.getElementById('guardia-hoy-form');
  if (!bd || !body || !form) return Promise.resolve({ proceed: true });

  const sala = String(ctx.sala || '').trim();
  const userId = String(ctx.userId || '');
  const teams = Array.isArray(ctx.teams) ? ctx.teams : [];
  const rank = String(ctx.rank || effectiveClinicalRank(clinicalSessionContext.user) || 'R1');
  const now = new Date();
  const salaGuardiaToday = mergeSalaGuardiaTodayRows(teams, ctx.salaGuardiaToday);
  const salaTeams = teams.filter((t) => String(t.sala || '') === sala);
  const renderCtx = {
    now,
    userId,
    rank,
    salaGuardiaToday,
    todayLetter: activeCycleLetterForDate('Sala', 'R1', now),
  };

  body.innerHTML = buildGuardiaHoyModalBodyHtml(salaTeams, renderCtx);
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');

  return bindGuardiaHoyModalActions({ bd, body, form, userId });
}
