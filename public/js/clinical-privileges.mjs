/** Renderer mirror of lib/db/clinical-privileges.mjs */

import { isWebClinicalClient } from './db-storage-bridge.mjs';
import { isMobileWeb } from './mobile-web.mjs';

/** iPad/PWA or any browser LAN session — never full Admin/R4 ward census. */
export function shouldEnforceTeamPatientMirror() {
  return isMobileWeb() || isWebClinicalClient();
}

const CLINICAL_RANKS = new Set(['R1', 'R2', 'R3', 'R4']);

/** @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user */
export function hasProgramAdminPrivileges(user) {
  if (!user) return false;
  if (user.is_program_admin === 1 || user.is_program_admin === true) return true;
  return String(user.rank || '') === 'Admin';
}

/** @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user */
export function effectiveClinicalRank(user) {
  const rank = String(user?.rank || 'R1');
  if (CLINICAL_RANKS.has(rank)) return rank;
  if (rank === 'Admin') return 'R1';
  return 'R1';
}

/** @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user */
export function canConfigureRotation(user) {
  const rank = effectiveClinicalRank(user);
  if (rank === 'R4') return true;
  return hasProgramAdminPrivileges(user);
}

/** @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user */
export function canManageInternoQr(user) {
  return canConfigureRotation(user);
}

/**
 * Cross-sala team browse and global patient census (R4, Admin, program admin).
 * @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user
 */
export function hasElevatedTeamPrivileges(user) {
  if (!user) return false;
  if (hasProgramAdminPrivileges(user)) return true;
  return effectiveClinicalRank(user) === 'R4';
}

/**
 * Desktop elevated census (R4/Admin): full ward + Filtros censo.
 * iPad/PWA always uses joined-team scope regardless of rank.
 * @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user
 */
export function shouldUseElevatedPatientCensus(user) {
  if (!hasElevatedTeamPrivileges(user)) return false;
  if (shouldEnforceTeamPatientMirror()) return false;
  return true;
}

/** Filtros censo toolbar — desktop elevated census or iPad/PWA team mirror. */
export function shouldShowClinicalCensusFilters(user) {
  if (!user?.user_id) return false;
  if (shouldUseElevatedPatientCensus(user)) return true;
  return shouldEnforceTeamPatientMirror();
}

/** @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user */
export function canViewLanUserDirectory(user) {
  return hasElevatedTeamPrivileges(user);
}

/** @param {{ rank?: string, is_program_admin?: number|boolean }|null|undefined} user */
export function canManageTeamRoster(user) {
  return hasElevatedTeamPrivileges(user);
}

/** Remove LAN directory users from the clinical DB (R4, Admin, program admin). */
export function canDeleteLanDirectoryUser(user) {
  return canManageTeamRoster(user);
}
