/** Mi rotación — preserve in-progress form state across silent panel refresh. */

const CREATE_FIELD_IDS = [
  'clinical-team-create-name',
  'clinical-team-create-sala',
  'clinical-team-create-service',
  'clinical-team-create-day',
  'clinical-team-create-r1-line',
];

const PROFILE_FIELD_IDS = [
  'clinical-profile-username',
  'clinical-profile-rank',
  'clinical-profile-sala',
  'clinical-profile-name',
];

const JOIN_CODE_FIELD_IDS = [
  'clinical-team-join-code-input',
  'clinical-team-join-code-cycle',
];

function teamsBackdropEl() {
  return document.getElementById('clinical-teams-backdrop');
}

function readFieldValue(id) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    return el.value;
  }
  return undefined;
}

function writeFieldValue(id, value) {
  const el = document.getElementById(id);
  if (value === undefined || el == null) return;
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    el.checked = !!value;
    return;
  }
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    el.value = String(value);
  }
}

function captureFieldGroup(ids) {
  /** @type {Record<string, string|boolean>} */
  const out = {};
  for (const id of ids) {
    const value = readFieldValue(id);
    if (value !== undefined) out[id] = value;
  }
  return out;
}

function restoreFieldGroup(values) {
  if (!values) return;
  for (const [id, value] of Object.entries(values)) {
    writeFieldValue(id, value);
  }
}

function hasDraftTextInTeamsPanel() {
  const createPanel = document.getElementById('clinical-team-create-panel');
  const createName = document.getElementById('clinical-team-create-name');
  if (
    createPanel instanceof HTMLElement &&
    !createPanel.hidden &&
    createName instanceof HTMLInputElement &&
    createName.value.trim()
  ) {
    return true;
  }

  const joinCode = document.getElementById('clinical-team-join-code-input');
  if (joinCode instanceof HTMLInputElement && joinCode.value.trim()) return true;

  const host = document.getElementById('clinical-teams-panel-body');
  if (!host) return false;
  for (const input of host.querySelectorAll('.clinical-teams-add-member-input')) {
    if (input instanceof HTMLInputElement && input.value.trim()) return true;
  }
  return false;
}

/** True when a silent refresh would disrupt an open sub-panel or draft fields. */
export function isClinicalTeamsPanelUserInteracting() {
  const bd = teamsBackdropEl();
  if (!bd?.classList.contains('open')) return false;

  const createPanel = document.getElementById('clinical-team-create-panel');
  if (createPanel instanceof HTMLElement && !createPanel.hidden) return true;

  if (document.querySelector('.clinical-teams-edit-panel:not([hidden])')) return true;

  const active = document.activeElement;
  if (active instanceof HTMLElement && bd.contains(active)) {
    if (active.matches('input, textarea, select')) return true;
    if (
      active instanceof HTMLOptionElement &&
      active.parentElement instanceof HTMLSelectElement &&
      bd.contains(active.parentElement)
    ) {
      return true;
    }
  }

  return hasDraftTextInTeamsPanel();
}

/** @param {HTMLElement} host */
export function captureClinicalTeamsPanelDraft(host) {
  const createPanel = document.getElementById('clinical-team-create-panel');
  const openBtn = document.getElementById('btn-clinical-team-create-open');

  /** @type {Array<{ teamId: string, username: string, cycle: string }>} */
  const addMember = [];
  host.querySelectorAll('.clinical-teams-add-member-form').forEach((form) => {
    if (!(form instanceof HTMLFormElement)) return;
    const input = form.querySelector('.clinical-teams-add-member-input');
    const cycleEl = form.querySelector('.clinical-teams-add-member-cycle');
    const username = input instanceof HTMLInputElement ? String(input.value || '').trim() : '';
    if (!username) return;
    addMember.push({
      teamId: String(form.dataset.teamId || ''),
      username,
      cycle: cycleEl instanceof HTMLSelectElement ? String(cycleEl.value || '') : '',
    });
  });

  /** @type {string[]} */
  const editPanelsOpen = [];
  host.querySelectorAll('.clinical-teams-edit-panel:not([hidden])').forEach((panel) => {
    const teamId = String(panel.getAttribute('data-team-id') || '').trim();
    if (teamId) editPanelsOpen.push(teamId);
  });

  const adminValue = readFieldValue('clinical-profile-admin');

  return {
    scrollTop: host.scrollTop,
    createPanelOpen: createPanel instanceof HTMLElement ? !createPanel.hidden : false,
    createOpenBtnHidden: openBtn instanceof HTMLElement ? openBtn.hidden : false,
    create: captureFieldGroup(CREATE_FIELD_IDS),
    profile: {
      ...captureFieldGroup(PROFILE_FIELD_IDS),
      ...(adminValue !== undefined ? { 'clinical-profile-admin': adminValue } : {}),
    },
    joinCode: captureFieldGroup(JOIN_CODE_FIELD_IDS),
    browseSala: String(document.getElementById('clinical-browse-sala')?.value || ''),
    addMember,
    editPanelsOpen,
  };
}

/** @param {HTMLElement} host @param {ReturnType<typeof captureClinicalTeamsPanelDraft>|null} draft */
export function restoreClinicalTeamsPanelDraft(host, draft) {
  if (!draft) return;

  restoreFieldGroup(draft.create);
  restoreFieldGroup(draft.profile);
  restoreFieldGroup(draft.joinCode);

  const createPanel = document.getElementById('clinical-team-create-panel');
  const openBtn = document.getElementById('btn-clinical-team-create-open');
  if (createPanel instanceof HTMLElement && openBtn instanceof HTMLElement) {
    createPanel.hidden = !draft.createPanelOpen;
    openBtn.hidden = draft.createOpenBtnHidden;
    if (draft.createPanelOpen) {
      void import('./teams-roster-create.mjs').then((m) => {
        m.syncCreateTeamServiceFromSala();
        m.syncCreateTeamCycleField();
      });
    }
  }

  if (draft.browseSala) {
    const browse = document.getElementById('clinical-browse-sala');
    if (browse instanceof HTMLSelectElement) browse.value = draft.browseSala;
  }

  for (const teamId of draft.editPanelsOpen || []) {
    const panel = host.querySelector(
      `.clinical-teams-edit-panel[data-team-id="${CSS.escape(teamId)}"]`
    );
    if (panel instanceof HTMLElement) panel.hidden = false;
  }

  for (const row of draft.addMember || []) {
    if (!row.teamId || !row.username) continue;
    const form = host.querySelector(
      `.clinical-teams-add-member-form[data-team-id="${CSS.escape(row.teamId)}"]`
    );
    if (!(form instanceof HTMLFormElement)) continue;
    const input = form.querySelector('.clinical-teams-add-member-input');
    const cycleEl = form.querySelector('.clinical-teams-add-member-cycle');
    if (input instanceof HTMLInputElement) input.value = row.username;
    if (cycleEl instanceof HTMLSelectElement && row.cycle) cycleEl.value = row.cycle;
  }

  host.scrollTop = Number.isFinite(draft.scrollTop) ? draft.scrollTop : 0;
}

export function closeCreateTeamPanelAfterSuccess() {
  const panel = document.getElementById('clinical-team-create-panel');
  const openBtn = document.getElementById('btn-clinical-team-create-open');
  const form = document.getElementById('clinical-team-create-form');
  if (panel instanceof HTMLElement) panel.hidden = true;
  if (openBtn instanceof HTMLElement) openBtn.hidden = false;
  if (form instanceof HTMLFormElement) form.reset();
}
