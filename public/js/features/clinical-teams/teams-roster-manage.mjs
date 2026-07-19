/** Mi rotación — team edit/leave/delete delegation. */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import { canManageTeamRoster } from '../../clinical-privileges.mjs';
import { dbApi, toast, currentUserId } from './shared.mjs';
import { publishClinicalTeamsToLan } from './teams-guardia-bridge.mjs';
import { refreshTeamsUiAfterChange, teamsModalEl } from './teams-roster-shell.mjs';

function closeTeamEditPanels(exceptPanel) {
  document.querySelectorAll('.clinical-teams-edit-panel').forEach((panel) => {
    if (exceptPanel && panel === exceptPanel) return;
    panel.hidden = true;
  });
}

function teamManageDelegationRoot() {
  return (
    document.getElementById('clinical-teams-panel-body') ||
    teamsModalEl()?.querySelector('.clinical-teams-modal') ||
    null
  );
}

export function wireTeamManageModalDelegation() {
  const root = teamManageDelegationRoot();
  if (!root || root._rpcTeamManageDelegated) return;
  root._rpcTeamManageDelegated = true;

  root.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    const leaveBtn = target.closest('.clinical-teams-leave-btn');
    if (leaveBtn instanceof HTMLButtonElement) {
      void handleLeaveTeamClick(leaveBtn);
      return;
    }

    if (!canManageTeamRoster(clinicalSessionContext.user)) return;

    const editBtn = target.closest('.clinical-teams-edit-btn');
    if (editBtn) {
      const card = editBtn.closest('.clinical-teams-card');
      const panel = card?.querySelector('.clinical-teams-edit-panel');
      if (panel instanceof HTMLElement) {
        closeTeamEditPanels(panel);
        panel.hidden = !panel.hidden;
      }
      return;
    }

    const cancelBtn = target.closest('.clinical-teams-edit-cancel');
    if (cancelBtn) {
      const panel = cancelBtn.closest('.clinical-teams-edit-panel');
      if (panel instanceof HTMLElement) panel.hidden = true;
      return;
    }

    const deleteBtn = target.closest('.clinical-teams-delete-btn');
    if (deleteBtn instanceof HTMLButtonElement) {
      void handleDeleteTeamClick(deleteBtn);
    }
  });
}

/** @param {HTMLButtonElement} btn */
async function handleLeaveTeamClick(btn) {
  const teamId = String(btn.dataset.teamId || '').trim();
  const teamName = String(btn.dataset.teamName || 'este equipo').trim();
  const userId = currentUserId();
  if (!teamId || !userId) return;

  const ok = window.confirm(
    `¿Salir del equipo «${teamName}»?\n\nDejarás de ver los pacientes asignados a ese equipo en Mi rotación.`
  );
  if (!ok) return;

  const api = dbApi();
  if (!api || typeof api.dbClinicalTeamsMemberRemove !== 'function') {
    toast('No se pudo salir del equipo.', 'error');
    return;
  }

  btn.disabled = true;
  const res = await api.dbClinicalTeamsMemberRemove({ teamId, userId });
  btn.disabled = false;
  if (!res || res.ok === false) {
    const err = String(res?.error || 'No se pudo salir del equipo.');
    if (/entregas activas/i.test(err)) {
      toast(
        `${err} Abre Guardia → «Solo mis entregas» para ver cuáles te bloquean; reasígnalas o libéralas (no hace falta documentar todo el censo).`,
        'error'
      );
    } else {
      toast(err, 'error');
    }
    return;
  }

  toast('Saliste del equipo.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  await publishClinicalTeamsToLan();
  await refreshTeamsUiAfterChange();
}

/** @param {HTMLButtonElement} btn */
async function handleDeleteTeamClick(btn) {
  const teamId = String(btn.dataset.teamId || '').trim();
  const teamName = String(btn.dataset.teamName || 'este equipo').trim();
  if (!teamId) return;

  const ok = window.confirm(
    `¿Eliminar el equipo «${teamName}»?\n\nSe quitarán sus integrantes. Esta acción no se puede deshacer.`
  );
  if (!ok) return;

  const userId = currentUserId();
  const api = dbApi();
  if (!userId || !api || typeof api.dbClinicalTeamsArchive !== 'function') {
    toast('No se pudo eliminar el equipo.', 'error');
    return;
  }

  btn.disabled = true;
  const res = await api.dbClinicalTeamsArchive({ teamId, callerUserId: userId });
  btn.disabled = false;

  if (!res || res.ok === false) {
    toast(res?.error || 'No se eliminó el equipo.', 'error');
    return;
  }

  toast('Equipo eliminado.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  await publishClinicalTeamsToLan();
}

/** @param {Event} ev @param {HTMLFormElement} form */
export async function handleEditTeamSubmit(ev, form) {
  ev.preventDefault();
  const teamId = String(form.dataset.teamId || '').trim();
  const nameInput = form.querySelector('.clinical-teams-edit-name');
  const salaSelect = form.querySelector('.clinical-teams-edit-sala');
  const name =
    nameInput instanceof HTMLInputElement ? String(nameInput.value || '').trim() : '';
  const sala =
    salaSelect instanceof HTMLSelectElement ? String(salaSelect.value || '').trim() : '';

  if (!teamId || !name || !sala) {
    toast('Indica nombre y sala.', 'error');
    return;
  }

  const userId = currentUserId();
  const api = dbApi();
  if (!userId || !api || typeof api.dbClinicalTeamsUpdate !== 'function') {
    toast('No se pudo guardar el equipo.', 'error');
    return;
  }

  await submitTeamEdit(api, { teamId, name, sala, userId, form });
}

async function submitTeamEdit(api, { teamId, name, sala, userId, form }) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
  const res = await api.dbClinicalTeamsUpdate({
    teamId,
    name,
    sala,
    callerUserId: userId,
  });
  if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;

  if (!res || res.ok === false) {
    toast(res?.error || 'No se guardó el equipo.', 'error');
    return;
  }

  toast('Equipo actualizado.', 'success');
  document.dispatchEvent(new CustomEvent('rpc-clinical-teams-changed'));
  await publishClinicalTeamsToLan();
}
