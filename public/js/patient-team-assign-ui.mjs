import {
  clinicalSessionContext,
  fetchClinicalScopeContextFromDb,
  getClinicalScopeContextForEvaluate,
} from './clinical-access-runtime.mjs';
import { resolvePatientTeamIdFromAssignments, stampPatientClinicalSala } from './clinico-access.mjs';
import { hasElevatedTeamPrivileges } from './clinical-privileges.mjs';
import { filterJoinedTeams } from './features/clinical-teams/shared.mjs';
import { resolveActiveTeamFilterId } from './features/clinical-census-filters-ui.mjs';
import { patients, saveState } from './app-state.mjs';
import { isCardionotasLanUiEnabled } from './features/cardio/cardionotas-gates.mjs';

import { esc } from './dom-escape.mjs';
function dbApi() {
  if (typeof window === 'undefined') return null;
  return window.rplusDb || window.electronAPI || null;
}

/** @param {object|null|undefined} user */
export function assignableTeamsForUser(user) {
  const teams = clinicalSessionContext.teams || [];
  if (!user?.user_id) return [];
  if (hasElevatedTeamPrivileges(user)) return teams.filter((t) => t && t.team_id);
  return filterJoinedTeams(teams, user);
}

/** @param {string} teamId */
export function teamLabelById(teamId) {
  const id = String(teamId || '').trim();
  if (!id) return '';
  const team = (clinicalSessionContext.teams || []).find((t) => String(t?.team_id) === id);
  if (!team) return id;
  return String(team.name || team.service || 'Equipo').trim() || 'Equipo';
}

/** @param {string} patientId */
export function activePatientTeamId(patientId) {
  const ctx = getClinicalScopeContextForEvaluate();
  return resolvePatientTeamIdFromAssignments(
    String(patientId || ''),
    ctx.assignments || [],
    ctx.now || new Date().toISOString()
  );
}

/**
 * @param {string} patientId
 * @param {string} teamId
 */
async function notifyPatientTeamAssigned(pid, tid) {
  syncLocalPatientSalaFromTeamAssignment(pid, tid);
  await fetchClinicalScopeContextFromDb();
  const lan = await import('./features/lan-sync.mjs').catch(() => null);
  if (lan?.pushClinicalOpsLanNow) await lan.pushClinicalOpsLanNow();
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('rpc-patient-team-assigned', { detail: { patientId: pid, teamId: tid } }));
  }
}

function syncLocalPatientSalaFromTeamAssignment(patientId, teamId) {
  const pid = String(patientId || '').trim();
  const tid = String(teamId || '').trim();
  if (!pid || !tid) return;
  const patient = (patients || []).find((p) => String(p?.id) === pid);
  if (!patient) return;
  const team = (clinicalSessionContext.teams || []).find((t) => String(t?.team_id) === tid);
  if (!team) return;
  const prev = String(patient.sala || '').trim();
  stampPatientClinicalSala(patient, clinicalSessionContext.user, { team });
  if (String(patient.sala || '').trim() !== prev) saveState();
}

export async function assignPatientToTeamClinical(patientId, teamId) {
  const api = dbApi();
  const pid = String(patientId || '').trim();
  const tid = String(teamId || '').trim();
  if (!api || !pid || !tid || typeof api.dbClinicalAssignPatientToTeam !== 'function') {
    return { ok: false, error: 'not_available' };
  }
  try {
    const res = await api.dbClinicalAssignPatientToTeam({
      patientId: pid,
      teamId: tid,
      effectiveAt: new Date().toISOString(),
    });
    if (!res || res.ok === false) return { ok: false, error: res?.error || 'assign_failed' };
    await notifyPatientTeamAssigned(pid, tid);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'assign_failed' };
  }
}

/** Default team preselect for new patient registration. */
export function defaultPatientRegistrationTeamId(user) {
  const teams = assignableTeamsForUser(user);
  if (!teams.length) return '';
  if (teams.length === 1) return String(teams[0].team_id || '');
  const preferred = resolveActiveTeamFilterId(user, clinicalSessionContext.teams || []);
  if (preferred && teams.some((t) => String(t.team_id) === preferred)) return preferred;
  return '';
}

function buildTeamSelectOptions(teams, selectedTeamId) {
  const selected = String(selectedTeamId || '');
  return teams
    .map(function (team) {
      const id = String(team.team_id || '');
      const label = String(team.name || team.service || 'Equipo').trim() || 'Equipo';
      const sel = id && id === selected ? ' selected' : '';
      return '<option value="' + esc(id) + '"' + sel + '>' + esc(label) + '</option>';
    })
    .join('');
}

/** @param {Record<string, unknown>} patient */
/** Populate #m-team in the patient registration modal (hidden when user has no teams). */
export function syncPatientRegistrationTeamSelect(selectedTeamId) {
  if (typeof document === 'undefined') return;
  const group = document.getElementById('m-team-group');
  const select = document.getElementById('m-team');
  if (!group || !select) return;
  if (!isCardionotasLanUiEnabled()) {
    group.hidden = true;
    group.style.display = 'none';
    select.innerHTML = '<option value="">— Sin asignar —</option>';
    select.value = '';
    return;
  }
  const user = clinicalSessionContext.user;
  const teams = assignableTeamsForUser(user);
  if (!teams.length) {
    group.style.display = 'none';
    select.innerHTML = '<option value="">— Sin asignar —</option>';
    select.value = '';
    return;
  }
  group.style.display = '';
  const selected = String(selectedTeamId || defaultPatientRegistrationTeamId(user) || '');
  select.innerHTML =
    '<option value="">— Sin asignar —</option>' + buildTeamSelectOptions(teams, selected);
  select.value = selected;
}

export function readPatientRegistrationTeamId() {
  if (typeof document === 'undefined') return '';
  const group = document.getElementById('m-team-group');
  const select = document.getElementById('m-team');
  if (!group || group.style.display === 'none' || !(select instanceof HTMLSelectElement)) return '';
  return String(select.value || '').trim();
}

export function buildPatientTeamAssignSectionHtml(patient) {
  if (!isCardionotasLanUiEnabled()) return '';
  const user = clinicalSessionContext.user;
  if (!user?.user_id || !patient?.id) return '';

  const patientId = String(patient.id);
  const teamId = activePatientTeamId(patientId);
  const joinedTeams = assignableTeamsForUser(user);

  if (!joinedTeams.length) {
    const readOnly = teamId
      ? '<input type="text" class="field-readonly" readonly value="' +
        esc(teamLabelById(teamId)) +
        '" aria-label="Equipo asignado">'
      : '<p class="profile-hint profile-hint--field">Sin equipo asignado.</p>';
    return (
      '<div class="field-group patient-team-assign-block">' +
      '<label>Equipo</label>' +
      readOnly +
      '<p class="profile-hint profile-hint--field">Únete a un equipo en <strong>Mi rotación</strong> para cambiar la asignación.</p>' +
      '</div>'
    );
  }

  const placeholder = teamId ? '— Cambiar equipo —' : '— Asignar a equipo —';
  const hint = teamId
    ? 'Cambia el equipo si el paciente cambió de cubeta. Solo el equipo activo verá el caso en ⇄.'
    : 'Al asignar, el paciente solo será visible para ese equipo en la red ⇄.';

  return (
    '<div class="field-group patient-team-assign-block">' +
    '<label for="patient-team-assign-select">Equipo</label>' +
    '<select id="patient-team-assign-select" class="profile-input patient-team-assign-select" onchange="onPatientTeamAssignChange(this.value)">' +
    '<option value="">' +
    esc(placeholder) +
    '</option>' +
    buildTeamSelectOptions(joinedTeams, teamId) +
    '</select>' +
  (teamId
    ? '<p class="profile-hint profile-hint--field">Equipo actual: <strong>' +
      esc(teamLabelById(teamId)) +
      '</strong></p>'
    : '') +
    '<p class="profile-hint profile-hint--field">' +
    hint +
    '</p>' +
    '</div>'
  );
}

function activePatientIdFromDom() {
  const wrap = document.getElementById('patient-data-form');
  if (wrap && wrap.dataset.patientId) return String(wrap.dataset.patientId);
  const mount =
    document.getElementById('exp-datos-modal-mount') || document.querySelector('.exp-datos-mount');
  if (mount && mount.dataset.patientId) return String(mount.dataset.patientId);
  return '';
}

export async function onPatientTeamAssignChange(teamId) {
  const patientId = activePatientIdFromDom();
  const tid = String(teamId || '').trim();
  if (!patientId || !tid) return;
  const prevTeamId = activePatientTeamId(patientId);
  if (prevTeamId && prevTeamId === tid) return;
  const res = await assignPatientToTeamClinical(patientId, tid);
  if (res.ok) {
    if (typeof window !== 'undefined' && typeof window.renderPatientDataPane === 'function') {
      window.renderPatientDataPane();
    }
    const patientsMod = await import('./features/patients.mjs').catch(() => null);
    if (patientsMod && typeof patientsMod.renderPatientList === 'function') {
      patientsMod.renderPatientList();
    }
    const label = teamLabelById(tid);
    const msg = prevTeamId
      ? 'Equipo actualizado a «' + label + '»'
      : 'Paciente asignado a «' + label + '»';
    await notifyAssignToast(msg, 'success');
    return;
  }
  await notifyAssignToast('No se pudo cambiar el equipo', 'error');
}

async function notifyAssignToast(msg, type) {
  try {
    const shell = await import('./app-shell.mjs');
    if (typeof shell.showToast === 'function') shell.showToast(msg, type);
  } catch (_e) { void _e; }
}

export function wirePatientTeamAssignRefresh() {
  if (typeof document === 'undefined' || document._patientTeamAssignRefreshWired) return;
  document._patientTeamAssignRefreshWired = true;
  const rerender = function () {
    if (typeof window !== 'undefined' && typeof window.renderPatientDataPane === 'function') {
      window.renderPatientDataPane();
    }
  };
  document.addEventListener('rpc-clinical-teams-changed', rerender);
  document.addEventListener('rpc-clinical-ops-synced', rerender);
  document.addEventListener('rpc-patient-team-assigned', rerender);
}

export const patientTeamAssignWindowHandlers = {
  onPatientTeamAssignChange,
};
