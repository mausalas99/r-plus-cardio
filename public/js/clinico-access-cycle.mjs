import { clinicalServiceForSala, clinicalSalaUsesAbcOnlyRotation } from '../../lib/clinical-salas.mjs';
import { normalizeServiceKey, toMillis } from './clinico-access-shared.mjs';

const CYCLE_CONFIGS = {
  sala_r2: { letters: ['A', 'B', 'C', 'D', 'E', 'F'], length: 6 },
  sala_r1: { letters: ['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2'], length: 8 },
  default: { letters: ['A', 'B', 'C', 'D'], length: 4 },
};

/** Sala ward teams only — not Torre HU / Área A (shared ABCD across ranks). */
export function isSalaWardService(service) {
  return normalizeServiceKey(service) === 'sala';
}

/**
 * Sala R1 primera/segunda línea picker — only Sala 1/2/E ward teams.
 * @param {string} [service]
 * @param {string} [sala]
 */
export function usesSalaR1LinePicker(service, sala) {
  if (clinicalSalaUsesAbcOnlyRotation(sala)) return false;
  const mapped = clinicalServiceForSala(sala);
  const svc = String(service || mapped || 'Sala').trim();
  return isSalaWardService(svc);
}

/**
 * Cycle letters for UI pickers (create / join / LAN assign).
 * @param {string} service
 * @param {string} rank
 */
export function getCycleLetterOptionsForRank(service, rank) {
  const r = String(rank || 'R1');
  if (isSalaWardService(service) && r === 'R2') {
    return getCycleLettersForTeamCreate(service, 'R2');
  }
  if (isSalaWardService(service) && r === 'R1') {
    return [
      ...getCycleLettersForTeamCreate(service, 'R1', 0),
      ...getCycleLettersForTeamCreate(service, 'R1', 1),
    ];
  }
  return getCycleLettersForTeamCreate(service, r);
}

export function getCycleConfig(service, rank) {
  if (isSalaWardService(service)) {
    if (rank === 'R2') return CYCLE_CONFIGS.sala_r2;
    if (rank === 'R1') return CYCLE_CONFIGS.sala_r1;
  }
  return CYCLE_CONFIGS.default;
}

/**
 * Letters offered when creating a team — depends on creator rank, not a single team-wide slot.
 * Sala R1: first half A1–D1 (R1 primera línea) or second half A2–D2 (R1 segunda línea).
 *
 * @param {string} service
 * @param {string} rank
 * @param {0|1} [r1LineIndex]
 */
export function getCycleLettersForTeamCreate(service, rank, r1LineIndex = 0) {
  const cfg = getCycleConfig(service, rank);
  if (rank === 'R1' && isSalaWardService(service)) {
    const half = Math.floor(cfg.letters.length / 2);
    return r1LineIndex === 1 ? cfg.letters.slice(half) : cfg.letters.slice(0, half);
  }
  return cfg.letters;
}

/**
 * @param {string} service
 * @param {string} rank
 * @param {0|1} [r1LineIndex]
 */
export function getCycleFieldMetaForTeamCreate(service, rank, r1LineIndex = 0) {
  if (isSalaWardService(service) && rank === 'R2') {
    return {
      label: 'Tu letra de ciclo (R2)',
      hint: 'Cada equipo de sala tiene tres puestos: R2 (A–F), R1 primera línea (A1–D1) y R1 segunda línea (A2–D2). Como R2 eliges tu letra A–F.',
    };
  }
  if (isSalaWardService(service) && rank === 'R1') {
    const line = r1LineIndex === 1 ? 'segunda línea (A2–D2)' : 'primera línea (A1–D1)';
    return {
      label: `Tu subciclo R1 · ${line}`,
      hint: 'No es la posición del equipo completo: cada R1 lleva su subciclo (A1–D1 o A2–D2) dentro del mismo equipo de sala.',
    };
  }
  return {
    label: 'Posición en ciclo',
    hint: 'Letra de rotación para este servicio.',
  };
}

export function letterIndexForTeam(team, rank) {
  const frac = String(team?.sub_area_fraction || '').trim().toUpperCase();
  if (!frac) return -1;
  const cfg = getCycleConfig(team?.service, rank);
  return cfg.letters.indexOf(frac);
}

export function isOnCallToday(team, rank, now) {
  const idx = letterIndexForTeam(team, rank);
  if (idx === -1) return false;
  const cfg = getCycleConfig(team?.service, rank);
  const d = now instanceof Date ? now : new Date(String(now));
  const dayOfMonth = d.getDate();
  return (dayOfMonth - 1) % cfg.length === idx;
}

/** Active cycle letter for a service/rank on a calendar day (day-of-month anchor). */
export function activeCycleLetterForDate(service, rank, now) {
  const cfg = getCycleConfig(service, rank);
  const d = now instanceof Date ? now : new Date(String(now));
  const idx = (d.getDate() - 1) % cfg.length;
  return cfg.letters[idx] || '';
}

/**
 * @param {{ preview_start_at?: string, effective_at?: string }|null|undefined} cycle
 * @param {Date|string|undefined} now
 */
export function isIncomingPreviewWindow(cycle, now) {
  if (!cycle?.preview_start_at || !cycle?.effective_at) return false;
  const t = toMillis(now);
  const start = toMillis(cycle.preview_start_at);
  const end = toMillis(cycle.effective_at);
  if (!Number.isFinite(t) || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  return t >= start && t < end;
}
