// Entrega modal open/close + form wiring
import {
  clinicalSessionContext,
  fetchClinicalScopeContextFromDb,
  refreshGuardiaCensusFromDb,
  getClinicalScopeContextForEvaluate,
} from '../../clinical-access-runtime.mjs';
import { computeSalaAbcdefDeficitWrite } from '../../clinico-access.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import { closeModalAnimated } from '../../ui-motion.mjs';
import {
  mountEntregaPendientesUi,
  resetEntregaModalUi,
  resolveEntregaActorRole,
} from '../entrega-modal-ui.mjs';
import { mergeSalaGuardiaTodayRows } from '../guardia-hoy-modal.mjs';
import { teamLabelById } from '../../patient-team-assign-ui.mjs';
import {
  entregaModalEl,
  resolveEntregaPatientRow,
  toast,
  userOptionLabel,
} from './clinical-entrega-util.mjs';
import {
  collectEntregaScopeUsers,
  ensureEntregaTargetUser,
  listEntregaTargets,
} from './clinical-entrega-targets.mjs';
import {
  entregaSourceTeamHint,
  entregaSourceTeamSelectOptions,
  findEntregaTeamById,
  lookupEntregaCensusTeamId,
  resolveEntregaSourceTeamId,
  entregaTeamOptionLabel,
} from './clinical-entrega-team.mjs';
import { persistEntregaFormState } from './clinical-entrega-submit.mjs';
import {
  getEntregaPhase,
  getEntregaPhaseCoveringUserId,
  resolveEntregaPhaseCovering,
  resolveUserSalaForEntrega,
} from './clinical-entrega-phase.mjs';

let entregaFormWired = false;
let entregaNavBusy = false;

function wireEntregaFormOnce() {
  if (entregaFormWired) return;
  entregaFormWired = true;

  const form = document.getElementById('entrega-form');
  const cancelBtn = document.getElementById('btn-entrega-cancel');
  const bd = entregaModalEl();

  if (cancelBtn) cancelBtn.addEventListener('click', () => closeEntregaModal());
  if (bd) {
    bd.addEventListener('click', (ev) => {
      if (ev.target === bd) closeEntregaModal();
    });
  }

  const navPrev = document.getElementById('entrega-nav-prev');
  const navNext = document.getElementById('entrega-nav-next');
  const navigateRosterPatient = async (delta) => {
    if (entregaNavBusy) return;
    const entregaForm = document.getElementById('entrega-form');
    const ids = entregaForm?._entregaRosterIds;
    const idx = entregaForm?._entregaPatientIndex;
    if (!ids?.length || !Number.isFinite(idx)) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= ids.length) return;

    entregaNavBusy = true;
    try {
      const saved = await persistEntregaFormState(entregaForm, { silent: true });
      if (!saved.ok) {
        toast(saved.error || 'Completa R1 y equipo antes de cambiar de paciente.', 'error');
        return;
      }
      openEntregaModal({
        patientId: String(ids[nextIdx]),
        patientIndex: nextIdx,
        patientTotal: ids.length,
        rosterPatientIds: ids,
        onConfirm: entregaForm._entregaOnConfirm,
      });
    } finally {
      entregaNavBusy = false;
    }
  };
  navPrev?.addEventListener('click', () => void navigateRosterPatient(-1));
  navNext?.addEventListener('click', () => void navigateRosterPatient(1));

  if (!form) return;

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const rosterMode = Array.isArray(form._entregaRosterIds) && form._entregaRosterIds.length > 0;
    const saved = await persistEntregaFormState(form, { silent: rosterMode });
    if (!saved.ok) return;

    if (rosterMode) {
      toast('Paciente guardado.', 'success');
      return;
    }

    const onConfirm = form._entregaOnConfirm;
    closeEntregaModal();
    if (typeof onConfirm === 'function') onConfirm();
  });
}

/**
 * @param {{
 *   patientId: string,
 *   guardiaId?: string,
 *   onConfirm?: () => void,
 *   patientIndex?: number,
 *   patientTotal?: number,
 *   rosterPatientIds?: string[],
 * }} opts
 */
export function openEntregaModal(opts) {
  void openEntregaModalAsync(opts);
}

function populateEntregaNavNameDx_(opts, patient) {
  const navName = document.getElementById('entrega-modal-nav-name');
  const navDx = document.getElementById('entrega-modal-nav-dx');
  if (navName) {
    const bed = patient?.bed_label || patient?.bed || '—';
    const name = String(patient?.name || '').trim();
    navName.textContent = name ? `${name} · Cama ${bed}` : '—';
  }
  if (navDx) {
    navDx.textContent = patient
      ? String(patient.diagnosticosText || patient.service || '').toUpperCase()
      : '';
  }
}

function populateEntregaNavRoster_(opts, phaseActive) {
  const navCounter = document.getElementById('entrega-modal-nav-counter');
  const activeBadge = document.getElementById('entrega-modal-active-badge');
  const navPrev = document.getElementById('entrega-nav-prev');
  const navNext = document.getElementById('entrega-nav-next');
  if (navCounter) {
    const idx = opts?.patientIndex;
    const total = opts?.patientTotal;
    navCounter.textContent =
      Number.isFinite(idx) && Number.isFinite(total) && total > 0
        ? `${idx + 1} de ${total}`
        : '';
  }
  if (activeBadge) activeBadge.classList.toggle('hidden', !phaseActive);
  const rosterIdx = Number.isFinite(opts?.patientIndex) ? opts.patientIndex : -1;
  const rosterTotal = Array.isArray(opts?.rosterPatientIds) ? opts.rosterPatientIds.length : 0;
  if (navPrev) navPrev.disabled = rosterIdx <= 0;
  if (navNext) navNext.disabled = rosterIdx < 0 || rosterIdx >= rosterTotal - 1;
}

function populateEntregaNavChrome_(opts, patient, phaseActive) {
  populateEntregaNavNameDx_(opts, patient);
  populateEntregaNavRoster_(opts, phaseActive);
}

function resolvePreferredEntregaCovering_(params) {
  const { existing, phaseCovering, teams, users, userId, rank, salaGuardiaToday } = params;
  let preferred = existing?.covering_user_id ? String(existing.covering_user_id) : phaseCovering || '';
  if (preferred || existing) return preferred;
  const salaForCover = resolveUserSalaForEntrega(teams, userId);
  const mergedGuardia = mergeSalaGuardiaTodayRows(teams, salaGuardiaToday);
  const phaseCoveringResolved =
    salaForCover &&
    resolveEntregaPhaseCovering({
      userId,
      rank,
      users,
      teams,
      sala: salaForCover,
      salaGuardiaToday: mergedGuardia,
      guardiaActivated: false,
      guardiaMode: !!clinicalSessionContext.guardiaMode,
    });
  if (phaseCoveringResolved?.coveringUserId === userId) return userId;
  return phaseCoveringResolved?.coveringUserId || preferred;
}

function buildEntregaCoveringState_(params) {
  const {
    existing,
    phase,
    phaseCovering,
    teams,
    users,
    userId,
    rank,
    salaGuardiaToday,
    salaDeficit,
  } = params;
  const { targets, flow } = listEntregaTargets(rank, teams, users, salaDeficit, { currentUserId: userId });
  const hideR1Picker = !!(phase?.active && phaseCovering);
  const preferred = resolvePreferredEntregaCovering_({
    existing,
    phaseCovering,
    teams,
    users,
    userId,
    rank,
    salaGuardiaToday,
  });
  let targetList = [...targets];
  for (const id of [preferred, phaseCovering]) {
    targetList = ensureEntregaTargetUser(targetList, users, id, phase?.coveringLabel || '');
  }
  const resolvedPreferred = preferred || targetList[0]?.user_id || '';
  return { targetList, flow, hideR1Picker, preferred: resolvedPreferred };
}

function populateEntregaCoveringSelect_(params) {
  const { targetList, preferred, hideR1Picker, phase } = params;
  const select = document.getElementById('entrega-covering-user');
  const coverHint = document.getElementById('entrega-covering-hint');
  if (!select) return;
  select.innerHTML = targetList
    .map((u) => `<option value="${u.user_id}">${userOptionLabel(u)}</option>`)
    .join('');
  if (preferred) select.value = preferred;
  if (hideR1Picker) {
    select.disabled = true;
    select.removeAttribute('required');
    if (coverHint) {
      const label = phase?.coveringLabel || select.selectedOptions?.[0]?.textContent || '';
      coverHint.textContent = label
        ? `R1 de guardia de este turno: ${label}`
        : 'R1 de guardia fijado al activar el turno.';
      coverHint.classList.remove('hidden');
    }
  } else {
    select.disabled = false;
    select.setAttribute('required', '');
    if (coverHint) {
      coverHint.textContent =
        'Residente de guardia que asumirá la cobertura nocturna de este paciente.';
    }
  }
}

async function populateEntregaSourceTeam_(params) {
  const { patientId, patientRow, teams, existing, userId } = params;
  const teamSelect = document.getElementById('entrega-source-team');
  const srcTeamHint = document.getElementById('entrega-source-team-hint');
  if (!teamSelect) return '';

  const scopeCtx = getClinicalScopeContextForEvaluate();
  const ctx = clinicalSessionContext.scopeContext || {};
  const assignments = scopeCtx.assignments || ctx.assignments || [];
  const censusTeamId = await lookupEntregaCensusTeamId(
    patientId,
    patientRow,
    teams,
    assignments,
    scopeCtx.now || new Date()
  );
  const hasCensusAssignment = !!censusTeamId;
  const hasExistingSourceTeam = !!existing?.source_team_id;
  const srcTeamId = resolveEntregaSourceTeamId(
    patientId,
    patientRow,
    teams,
    assignments,
    existing,
    userId
  );
  const teamHintText = entregaSourceTeamHint({ hasCensusAssignment, hasExistingSourceTeam });
  const srcTeam = findEntregaTeamById(srcTeamId, teams);
  const censusLabel = srcTeam
    ? entregaTeamOptionLabel(srcTeam)
    : srcTeamId
      ? teamLabelById(srcTeamId)
      : '';

  if (hasCensusAssignment && srcTeamId && censusLabel) {
    teamSelect.innerHTML = `<option value="${srcTeamId}">${censusLabel}</option>`;
    teamSelect.value = String(srcTeamId);
    teamSelect.disabled = true;
    teamSelect.removeAttribute('required');
  } else {
    const teamOptions = entregaSourceTeamSelectOptions(
      srcTeamId,
      teams,
      userId,
      clinicalSessionContext.user
    );
    teamSelect.innerHTML = teamOptions
      .map((t) => `<option value="${t.team_id}">${entregaTeamOptionLabel(t)}</option>`)
      .join('');
    teamSelect.disabled = false;
    teamSelect.setAttribute('required', '');
    if (srcTeamId) teamSelect.value = srcTeamId;
  }
  if (srcTeamHint) {
    srcTeamHint.textContent = teamHintText;
    srcTeamHint.classList.remove('hidden');
  }
  return srcTeamId;
}

function populateEntregaFlowHint_(flow) {
  const hint = document.getElementById('entrega-flow-hint');
  if (!hint) return;
  const flowLabels = {
    r2: 'R2: mismo servicio, R4, o cubridores Sala en déficit.',
    r2_handoff: 'R2: selecciona R4 de Sala y R2 de guardia (dos entregas separadas).',
    r3_suggest: 'R3: sugeridos por día de guardia del equipo (confirma).',
    generic: 'Cualquier usuario registrado.',
  };
  if (flow === 'r1') {
    hint.textContent = '';
    hint.hidden = true;
    return;
  }
  hint.textContent = flowLabels[flow] || flowLabels.generic;
  hint.hidden = false;
}

function setEntregaModalTitle_(existing, guardiaId, actor) {
  const title = document.getElementById('entrega-modal-title');
  if (!title) return;
  if (guardiaId || existing?.guardia_id) {
    title.textContent = actor.role === 'guardia' ? 'Pendientes de guardia' : 'Actualizar entrega';
  } else if (clinicalSessionContext.guardiaMode) {
    title.textContent = 'Entrega / pendientes';
  } else {
    title.textContent = 'Nueva entrega';
  }
}

function showEntregaModal_(bd, hideR1Picker, teamSelect, select) {
  const coverHint = document.getElementById('entrega-covering-hint');
  if (coverHint) coverHint.classList.toggle('hidden', !coverHint.textContent?.trim());
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  if (hideR1Picker) teamSelect?.focus();
  else select?.focus();
}

async function finalizeEntregaModalOpen_(params) {
  const { bd, existing, guardiaId, patientRow, srcTeamId, hideR1Picker, teamSelect, select } =
    params;
  const actor = resolveEntregaActorRole(clinicalSessionContext.user, existing);
  await mountEntregaPendientesUi({
    actor,
    pendientesJson: existing?.pendientes_json,
    sourceTeamId: srcTeamId,
    vitalsFrequency: existing?.vitals_frequency,
    isCritical: !!(existing?.is_critical),
    signedRefusal: !!Number(patientRow?.negativa_maniobras_firmada),
  });
  setEntregaModalTitle_(existing, guardiaId, actor);
  showEntregaModal_(bd, hideR1Picker, teamSelect, select);
}

async function guardEntregaPatientSwitch_(bd, form, patientId) {
  const priorPatientId = String(form.dataset.patientId || '');
  const switchingPatient =
    bd.classList.contains('open') &&
    priorPatientId &&
    patientId &&
    priorPatientId !== patientId &&
    Array.isArray(form._entregaRosterIds) &&
    form._entregaRosterIds.length > 0;
  if (!switchingPatient) return true;
  const saved = await persistEntregaFormState(form, { silent: true });
  if (saved.ok) return true;
  toast(saved.error || 'Completa R1 y equipo antes de cambiar de paciente.', 'error');
  return false;
}

function bindEntregaFormDataset_(form, opts, patientId, guardiaId) {
  form.dataset.patientId = patientId;
  if (guardiaId) form.dataset.guardiaId = guardiaId;
  else delete form.dataset.guardiaId;
  form._entregaOnConfirm = typeof opts?.onConfirm === 'function' ? opts.onConfirm : null;
  form._entregaRosterIds = Array.isArray(opts?.rosterPatientIds) ? opts.rosterPatientIds.slice() : null;
  form._entregaPatientIndex = Number.isFinite(opts?.patientIndex) ? opts.patientIndex : null;
}

async function loadEntregaModalContext_(opts) {
  await refreshGuardiaCensusFromDb(null);
  await fetchClinicalScopeContextFromDb();
  const patientId = String(opts?.patientId || '');
  const guardiaId = opts?.guardiaId ? String(opts.guardiaId) : '';
  const existing = guardiaId
    ? clinicalSessionContext.guardias.find((g) => String(g.guardia_id) === guardiaId)
    : clinicalSessionContext.guardiasMap.get(patientId);
  const ctx = clinicalSessionContext.scopeContext || {};
  const teams = clinicalSessionContext.teams || ctx.teams || [];
  const users = collectEntregaScopeUsers(ctx, teams, clinicalSessionContext.user);
  const salaGuardiaToday = Array.isArray(ctx.salaGuardiaToday) ? ctx.salaGuardiaToday : [];
  const userId = String(clinicalSessionContext.user?.user_id || '');
  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const salaDeficit = computeSalaAbcdefDeficitWrite(salaGuardiaToday, teams, userId, new Date());
  const phase = getEntregaPhase();
  const phaseCovering = getEntregaPhaseCoveringUserId();
  const coveringState = buildEntregaCoveringState_({
    existing,
    phase,
    phaseCovering,
    teams,
    users,
    userId,
    rank,
    salaGuardiaToday,
    salaDeficit,
  });
  return {
    patientId,
    guardiaId,
    existing,
    teams,
    userId,
    coveringState,
    patient: resolveEntregaPatientRow(patientId),
  };
}

async function openEntregaModalAsync(opts) {
  wireEntregaFormOnce();

  const bd = entregaModalEl();
  const form = document.getElementById('entrega-form');
  if (!bd || !form) return;

  const patientId = String(opts?.patientId || '');
  if (!(await guardEntregaPatientSwitch_(bd, form, patientId))) return;

  const modalCtx = await loadEntregaModalContext_(opts);
  bindEntregaFormDataset_(form, opts, modalCtx.patientId, modalCtx.guardiaId);
  populateEntregaNavChrome_(opts, modalCtx.patient, !!getEntregaPhase()?.active);

  const { targetList, flow, hideR1Picker, preferred } = modalCtx.coveringState;
  form.querySelector('.entrega-top-strip')?.classList.toggle('entrega-top-strip--phase-covering-set', hideR1Picker);
  populateEntregaCoveringSelect_({ targetList, preferred, hideR1Picker, phase: getEntregaPhase() });

  const patientRow = modalCtx.patient || resolveEntregaPatientRow(modalCtx.patientId);
  const srcTeamId = await populateEntregaSourceTeam_({
    patientId: modalCtx.patientId,
    patientRow,
    teams: modalCtx.teams,
    existing: modalCtx.existing,
    userId: modalCtx.userId,
  });
  populateEntregaFlowHint_(flow);

  await finalizeEntregaModalOpen_({
    bd,
    form,
    existing: modalCtx.existing,
    guardiaId: modalCtx.guardiaId,
    patientRow,
    srcTeamId,
    hideR1Picker,
    teamSelect: document.getElementById('entrega-source-team'),
    select: document.getElementById('entrega-covering-user'),
  });
}

export function closeEntregaModal() {
  const bd = entregaModalEl();
  if (!bd) return;
  closeModalAnimated(bd, function () {
    resetEntregaModalUi();
    const form = document.getElementById('entrega-form');
    if (form) form._entregaOnConfirm = null;
  });
}
