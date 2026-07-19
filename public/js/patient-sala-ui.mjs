import { CLINICAL_SALA_VALUES } from '../../lib/clinical-salas.mjs';
import { clinicalSessionContext } from './clinical-access-runtime.mjs';
import { esc } from './dom-escape.mjs';

/** @param {object[]|null|undefined} teams @param {string} teamId */
function findTeamById(teams, teamId) {
  const id = String(teamId || '').trim();
  if (!id) return null;
  return (teams || []).find((t) => String(t?.team_id || '') === id) || null;
}

/**
 * Default sala for new patient registration: team sala, else profile sala.
 * @param {{ sala?: string|null|undefined }|null|undefined} user
 * @param {string} [teamId]
 * @param {object[]} [teams]
 */
export function resolveRegistrationSalaDefault(user, teamId, teams) {
  const team = findTeamById(teams, teamId);
  const teamSala = String(team?.sala || '').trim();
  if (teamSala) return teamSala;
  return String(user?.sala || '').trim();
}

function buildSalaOptionsHtml(selected) {
  const sel = String(selected || '').trim();
  return (
    '<option value="">— Seleccionar —</option>' +
    CLINICAL_SALA_VALUES.map(
      (s) => `<option value="${esc(s)}"${s === sel ? ' selected' : ''}>${esc(s)}</option>`
    ).join('')
  );
}

/** Sala dropdown for Expediente → Datos. */
export function buildPatientSalaFieldHtml(patient) {
  const sala = String(patient?.sala || '').trim();
  return (
    '<div class="field-group patient-sala-field">' +
    '<label for="patient-sala-select">Sala</label>' +
    '<select id="patient-sala-select" class="profile-input" onchange="updatePatient(\'sala\',this.value)">' +
    buildSalaOptionsHtml(sala) +
    '</select>' +
    '<p class="profile-hint profile-hint--field">Ubicación clínica para censo y ⇄. Al asignar equipo, la sala del equipo puede actualizarla.</p>' +
    '</div>'
  );
}

/** Sync #m-sala in the new-patient modal. */
export function syncPatientRegistrationSalaSelect(teamId) {
  if (typeof document === 'undefined') return;
  const select = document.getElementById('m-sala');
  if (!(select instanceof HTMLSelectElement)) return;
  const user = clinicalSessionContext.user;
  const teams = clinicalSessionContext.teams || [];
  let tid = teamId;
  if (tid == null) {
    const teamSel = document.getElementById('m-team');
    tid = teamSel instanceof HTMLSelectElement ? teamSel.value : '';
  }
  const defaultSala = resolveRegistrationSalaDefault(user, tid, teams);
  select.innerHTML = buildSalaOptionsHtml(defaultSala);
  select.value = defaultSala;
}

/** @returns {string} */
export function readPatientRegistrationSala() {
  if (typeof document === 'undefined') return '';
  const select = document.getElementById('m-sala');
  if (!(select instanceof HTMLSelectElement)) return '';
  return String(select.value || '').trim();
}

/** Keep registration sala in sync when equipo changes. */
export function wirePatientRegistrationSalaControls() {
  if (typeof document === 'undefined' || document._patientRegistrationSalaWired) return;
  document._patientRegistrationSalaWired = true;
  const teamSel = document.getElementById('m-team');
  if (teamSel && !teamSel._patientRegistrationSalaWired) {
    teamSel._patientRegistrationSalaWired = true;
    teamSel.addEventListener('change', () => {
      syncPatientRegistrationSalaSelect(teamSel.value);
    });
  }
}
