/** Mi rotación — create/join team form HTML. */
import { clinicalSessionContext } from '../../clinical-access-runtime.mjs';
import {
  getCycleLettersForTeamCreate,
  getCycleFieldMetaForTeamCreate,
  getCycleLetterOptionsForRank,
  usesSalaR1LinePicker,
} from '../../clinico-access.mjs';
import { clinicalServiceForSala } from '../../../../lib/clinical-salas.mjs';
import {
  getTeamCompositionLimits,
  serviceUsesStructuredComposition,
} from '../../../../lib/clinical-team-composition.mjs';
import { effectiveClinicalRank, canManageTeamRoster } from '../../clinical-privileges.mjs';
import {
  escapeHtml,
  escapeAttr,
  hintHtml,
  CLINICAL_TEAM_SERVICES,
  CLINICAL_SALAS,
  renderClinicalTeamsCollapsible,
} from './shared.mjs';
import { renderLanUsersDirectoryTopButtonHtml } from './teams-roster-lan.mjs';
import { renderCycleSelectForRank } from './teams-roster-team-cards.mjs';

function compositionHintForService(service) {
  if (!serviceUsesStructuredComposition(service)) return '';
  const limits = getTeamCompositionLimits(service);
  if (!limits) return '';
  const parts = [];
  if (limits.r1) parts.push(`${limits.r1} R1`);
  if (limits.r2) parts.push(`${limits.r2} R2`);
  if (limits.r3) parts.push(`${limits.r3} R3`);
  return parts.length
    ? `<p class="clinical-teams-hint clinical-teams-composition-hint">Composición: ${parts.join(', ')}.</p>`
    : '';
}

function setR1LineGroupVisible(visible) {
  const r1LineGroup = document.getElementById('clinical-team-r1-line-group');
  if (!r1LineGroup) return;
  r1LineGroup.hidden = !visible;
  r1LineGroup.style.display = visible ? '' : 'none';
}

export function syncCreateTeamServiceFromSala() {
  const salaSelect = document.getElementById('clinical-team-create-sala');
  const serviceSelect = document.getElementById('clinical-team-create-service');
  const userSala = String(clinicalSessionContext.user?.sala || '').trim();
  if (salaSelect && userSala && !String(salaSelect.value || '').trim()) {
    salaSelect.value = userSala;
  }
  const sala = String(salaSelect?.value || userSala || '').trim();
  const mapped = clinicalServiceForSala(sala);
  if (serviceSelect && mapped) {
    serviceSelect.value = mapped;
  }
  syncCreateTeamCycleField();
}

function updateCreateTeamCycleLabels(meta, service) {
  const label = document.getElementById('clinical-team-create-day-label');
  const hint = document.getElementById('clinical-team-create-day-hint');
  const compositionHint = document.getElementById('clinical-team-composition-hint');
  if (label) label.textContent = meta.label;
  if (hint) hint.textContent = meta.hint;
  if (compositionHint) compositionHint.innerHTML = compositionHintForService(service);
}

function refreshCreateTeamDayOptions(daySelect, letters, prev) {
  if (!daySelect) return;
  daySelect.innerHTML = letters
    .map((letter) => `<option value="${escapeAttr(letter)}">${escapeHtml(letter)}</option>`)
    .join('');
  if (prev && letters.includes(prev)) daySelect.value = prev;
}

function readCreateTeamCycleContext() {
  const sala = String(
    document.getElementById('clinical-team-create-sala')?.value ||
      clinicalSessionContext.user?.sala ||
      ''
  ).trim();
  const service = String(document.getElementById('clinical-team-create-service')?.value || 'Sala');
  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const r1Line = Number(document.getElementById('clinical-team-create-r1-line')?.value || 0);
  return { sala, service, rank, r1Line };
}

export function syncCreateTeamCycleField() {
  const { sala, service, rank, r1Line } = readCreateTeamCycleContext();
  const showR1Line = rank === 'R1' && usesSalaR1LinePicker(service, sala);
  const meta = getCycleFieldMetaForTeamCreate(service, rank, showR1Line && r1Line === 1 ? 1 : 0);
  const daySelect = document.getElementById('clinical-team-create-day');
  setR1LineGroupVisible(showR1Line);
  updateCreateTeamCycleLabels(meta, service);
  const prev = String(daySelect?.value || '');
  const letters =
    showR1Line && rank === 'R1'
      ? getCycleLettersForTeamCreate(service, rank, r1Line === 1 ? 1 : 0)
      : getCycleLetterOptionsForRank(service, rank);
  refreshCreateTeamDayOptions(daySelect, letters, prev);
}

export function renderCreateTeamForm() {
  const user = clinicalSessionContext.user || {};
  if (canManageTeamRoster(user)) {
    return renderCreateTeamFormElevated(user);
  }
  return renderCreateTeamFormStandard();
}

export function renderCreateTeamFormElevated(user) {
  const homeSala = String(user?.sala || '').trim();
  return `
    <form id="clinical-team-create-form" class="clinical-teams-create-form clinical-teams-create-form--elevated">
      <div class="field-group">
        <label for="clinical-team-create-name">Nombre del equipo</label>
        <input id="clinical-team-create-name" type="text" class="profile-input" placeholder="Equipo A · Dr. Gutiérrez" required>
        ${hintHtml('Solo el nombre; sin integrantes todavía.')}
      </div>
      <div class="field-group">
        <label for="clinical-team-create-sala">Sala</label>
        <select id="clinical-team-create-sala" class="profile-input" required>
          <option value="">— Seleccionar sala —</option>
          ${CLINICAL_SALAS.map(
            (s) =>
              `<option value="${escapeAttr(s)}" ${homeSala === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
          ).join('')}
        </select>
      </div>
      <p class="clinical-teams-hint clinical-teams-create-elevated-hint">Asigna residentes después desde <strong>Directorio de usuarios LAN</strong>.</p>
      <div class="modal-actions clinical-teams-create-submit-wrap">
        <button type="submit" class="btn-save">Crear equipo vacío</button>
        <button type="button" class="btn-med-secondary clinical-teams-create-cancel">Cancelar</button>
      </div>
    </form>`;
}

export function renderCreateTeamFormStandard() {
  const userSala = String(clinicalSessionContext.user?.sala || '').trim();
  const defaultService = clinicalServiceForSala(userSala) || CLINICAL_TEAM_SERVICES[0];
  const serviceOptions = CLINICAL_TEAM_SERVICES.map(
    (svc) =>
      `<option value="${escapeAttr(svc)}" ${svc === defaultService ? 'selected' : ''}>${escapeHtml(svc)}</option>`
  ).join('');
  const rank = effectiveClinicalRank(clinicalSessionContext.user);
  const defaultLetters = getCycleLetterOptionsForRank(defaultService, rank);
  const defaultMeta = getCycleFieldMetaForTeamCreate(defaultService, rank, 0);
  const letterOptions = defaultLetters
    .map((letter) => `<option value="${escapeAttr(letter)}">${escapeHtml(letter)}</option>`)
    .join('');
  const showR1Line = rank === 'R1' && usesSalaR1LinePicker(defaultService, userSala);

  return `
    <form id="clinical-team-create-form" class="clinical-teams-create-form">
      <div class="field-group" id="clinical-team-sala-group">
        <label for="clinical-team-create-sala">Sala</label>
        <select id="clinical-team-create-sala" class="profile-input">
          <option value="">— Seleccionar sala —</option>
          ${CLINICAL_SALAS.map(
            (s) =>
              `<option value="${escapeAttr(s)}" ${s === userSala ? 'selected' : ''}>${escapeHtml(s)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field-group">
        <label for="clinical-team-create-name">Nombre del equipo (residente líder)</label>
        <input id="clinical-team-create-name" type="text" class="profile-input" placeholder="Dr. Gutiérrez" required>
      </div>
      <div class="field-group" id="clinical-team-r1-line-group" ${showR1Line ? '' : 'hidden style="display:none"'}>
        <label for="clinical-team-create-r1-line">Línea R1 en el equipo</label>
        <select id="clinical-team-create-r1-line" class="profile-input">
          <option value="0">Primera línea · A1–D1</option>
          <option value="1">Segunda línea · A2–D2</option>
        </select>
      </div>
      <div class="clinical-teams-create-service-row">
        <div class="field-group">
          <label for="clinical-team-create-service">Servicio</label>
          <select id="clinical-team-create-service" class="profile-input" required>${serviceOptions}</select>
        </div>
        <div class="field-group">
          <label id="clinical-team-create-day-label" for="clinical-team-create-day">${escapeHtml(defaultMeta.label)}</label>
          <select id="clinical-team-create-day" class="profile-input" required>${letterOptions}</select>
        </div>
      </div>
      <p id="clinical-team-create-day-hint" class="clinical-teams-hint clinical-teams-create-cycle-hint">${escapeHtml(defaultMeta.hint)}</p>
      <div id="clinical-team-composition-hint">${compositionHintForService(defaultService)}</div>
      <div class="modal-actions clinical-teams-create-submit-wrap">
        <button type="submit" class="btn-save">Crear equipo</button>
        <button type="button" class="btn-med-secondary clinical-teams-create-cancel">Cancelar</button>
      </div>
    </form>`;
}

export function renderCreateTeamSectionHtml() {
  const user = clinicalSessionContext.user || {};
  const elevatedCreate = canManageTeamRoster(user);
  const openLabel = elevatedCreate ? 'Crear equipo vacío' : 'Crear nuevo equipo';
  const lanDirBtn = renderLanUsersDirectoryTopButtonHtml(user);
  const actionsClass = lanDirBtn
    ? 'clinical-teams-top-actions clinical-teams-top-actions--split'
    : 'clinical-teams-top-actions';
  return `
    <section class="clinical-teams-section clinical-teams-section--create">
      <div class="${actionsClass}">
        <button type="button" id="btn-clinical-team-create-open" class="btn-save clinical-teams-create-open-btn">${escapeHtml(openLabel)}</button>
        ${lanDirBtn}
      </div>
      <div id="clinical-team-create-panel" class="clinical-teams-create-panel" hidden>
        ${renderCreateTeamForm()}
      </div>
    </section>`;
}

export function renderJoinWithCodeSectionHtml() {
  const joinForm = `
      <form id="clinical-team-join-code-form" class="clinical-teams-join-code-form">
        <div class="clinical-teams-invite-row clinical-teams-join-code-code-row">
          <label class="visually-hidden" for="clinical-team-join-code-input">Código de equipo</label>
          <input id="clinical-team-join-code-input" type="text" class="profile-input" placeholder="ej. 2017936e" maxlength="36" autocomplete="off" required>
        </div>
        <div class="field-group clinical-teams-add-cycle-group">
          <label for="clinical-team-join-code-cycle">Tu ciclo al unirte</label>
          ${renderCycleSelectForRank(
            {
              service:
                clinicalServiceForSala(clinicalSessionContext.user?.sala) || 'Sala',
              team_id: 'join',
            },
            effectiveClinicalRank(clinicalSessionContext.user),
            '',
            'clinical-team-join-code-cycle'
          )}
        </div>
        <div class="clinical-teams-join-submit-wrap">
          <button type="submit" class="btn-save">Unirme</button>
        </div>
      </form>`;
  return `
    <section class="clinical-teams-section clinical-teams-section--join-code">
      ${renderClinicalTeamsCollapsible({
        collapseKey: 'section.joinCode',
        defaultOpen: false,
        className: 'clinical-teams-collapse--section',
        summaryHtml: `
          <h4 class="clinical-teams-section-title">Unirte con código de equipo</h4>
          <p class="clinical-teams-section-desc">Pega el código que te envió tu R2 (8 caracteres). <strong>No</strong> pegues aquí el enlace ⇄ de sala (<code>http://…/join/req_…</code>) — ese va en <strong>Wi‑Fi → Conexión guardia</strong>.</p>`,
        bodyHtml: joinForm,
      })}
    </section>`;
}
