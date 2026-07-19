import { isClinicalLocalOnlyMode, readRpcSettings } from '../clinical-settings.mjs';
import { clinicalSessionContext } from '../clinical-access-runtime.mjs';
import { normalizeUsername } from '../clinical-username.mjs';
import { needsClinicalOnboarding, needsTeamOnboarding } from './clinical-onboarding.mjs';
import { filterJoinedTeams } from './clinical-teams/shared.mjs';
import { hasElevatedTeamPrivileges } from '../clinical-privileges.mjs';

/** @returns {{ primary: string, sub: string, pending: boolean }|null} */
export function buildEntryStatusEarly() {
  if (isClinicalLocalOnlyMode(readRpcSettings())) {
    return { primary: 'Solo este equipo', sub: 'Ajeno a medicina interna · sin LAN', pending: false };
  }
  if (needsClinicalOnboarding()) {
    return {
      primary: 'Configura tu rotación',
      sub: 'Usuario LAN, rango y sala — equipos después en Mi rotación',
      pending: true,
    };
  }
  const user = clinicalSessionContext.user;
  if (!user?.user_id) {
    return { primary: 'Mi rotación', sub: 'Completa la configuración inicial abajo', pending: true };
  }
  return null;
}

/** @param {object} user */
export function buildEntryStatusPrimary(user) {
  const handle = normalizeUsername(user.username || '');
  const rank = String(user.rank || '').trim();
  const sala = String(user.sala || '').trim();
  const parts = [];
  if (handle) parts.push('@' + handle);
  if (rank) parts.push(rank);
  if (sala) parts.push(sala);
  return parts.length ? parts.join(' · ') : 'Mi rotación';
}

/** @param {object} user @param {Array<object>} teams */
export function buildEntryStatusSub(user, teams) {
  const name = String(user.clinical_name || '').trim();
  if (hasElevatedTeamPrivileges(user)) {
    return name || 'Supervisión de rotaciones — sin equipo requerido';
  }
  if (teams.length === 1) return 'Equipo: ' + String(teams[0].name || '—');
  if (teams.length > 1) return teams.length + ' equipos';
  if (needsTeamOnboarding()) return 'Sin equipo — abre para buscar en tu sala o unirte';
  return name || 'Equipos, entregas y perfil clínico';
}

/** @returns {{ primary: string, sub: string, pending: boolean }} */
export function buildClinicalRotationEntryStatus() {
  const early = buildEntryStatusEarly();
  if (early) return early;
  const user = clinicalSessionContext.user;
  const teams = filterJoinedTeams(clinicalSessionContext.teams || [], user);
  return {
    primary: buildEntryStatusPrimary(user),
    sub: buildEntryStatusSub(user, teams),
    pending: false,
  };
}
