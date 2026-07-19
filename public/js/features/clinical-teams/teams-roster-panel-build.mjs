/** Mi rotación — panel HTML builders extracted from renderClinicalTeamsPanelInto. */
import {
  effectiveClinicalRank,
  hasProgramAdminPrivileges,
  canViewLanUserDirectory,
} from '../../clinical-privileges.mjs';
import {
  isLegacyMachineUsername,
  isValidUsernameFormat,
  normalizeUsername,
} from '../../clinical-username.mjs';
import {
  escapeHtml,
  escapeAttr,
  hintHtml,
  CLINICAL_SALAS,
  renderClinicalTeamsCollapsible,
} from './shared.mjs';

export function resolveDisplayLanHandle(user, usernameForInput) {
  const saved = normalizeUsername(user?.username || '');
  if (saved && isValidUsernameFormat(saved)) return saved;
  const draft = normalizeUsername(usernameForInput || '');
  if (draft && isValidUsernameFormat(draft)) return draft;
  return '';
}

export async function resolveClinicalTeamsPanelContext(user, joined) {
  let clientId = '';
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem('rpc-settings') || '{}');
    clientId = String(settings.clientId || '');
  } catch (_e) { void _e; }

  const rawUsername = String(user.username || '');
  const legacyUsername = isLegacyMachineUsername(rawUsername, clientId);
  const { needsClinicalLanProfileGate, ensureLanProfileGateDeviceReset } = await import(
    '../../clinical-settings.mjs'
  );
  settings = ensureLanProfileGateDeviceReset(settings);
  const profileGatePending = needsClinicalLanProfileGate(settings);
  const usernameForInput = profileGatePending
    ? ''
    : legacyUsername
      ? String(settings.clinicalUsername || '').trim()
      : rawUsername;
  const displayHandle = resolveDisplayLanHandle(user, usernameForInput);
  const savedHandle = normalizeUsername(user.username || '');
  const rank = effectiveClinicalRank(user);
  const programAdmin = hasProgramAdminPrivileges(user);
  const canViewLanUsers = canViewLanUserDirectory(user);
  const sala = String(user.sala || '').trim();

  return {
    legacyUsername,
    profileGatePending,
    usernameForInput,
    displayHandle,
    savedHandle,
    rank,
    programAdmin,
    canViewLanUsers,
    sala,
    joined,
  };
}

export function buildClinicalTeamsHandleHint(ctx) {
  if (!ctx.displayHandle) return '';
  return `<p class="clinical-teams-lead clinical-teams-handle-hint">Tu usuario LAN: <strong>@${escapeHtml(ctx.displayHandle)}</strong> — compártelo para que te agreguen a un equipo.${ctx.savedHandle !== ctx.displayHandle ? ' Pulsa <strong>Guardar perfil</strong> para registrarlo en la red.' : ''}</p>`;
}

export function buildClinicalProfileSectionHtml(ctx, user) {
  const clinicalName = ctx.profileGatePending ? '' : escapeHtml(user.clinical_name || '');
  const legacyBanner = ctx.legacyUsername
    ? '<p class="clinical-teams-legacy-banner">Registra tu usuario LAN (obligatorio). Sin esto no apareces en equipos ni entregas.</p>'
    : '';
  const lanDirectoryNote = ctx.canViewLanUsers
    ? ''
    : `<p class="clinical-teams-lan-directory-note">El directorio completo de usuarios LAN lo abren <strong>R4</strong>, <strong>Admin</strong> o quien tenga <strong>privilegios de administración</strong>. Al registrar <strong>@usuario</strong> debes tener la sala <strong>⇄</strong> activa (o haberte unido con invitación); R+ publica tu perfil al guardar.</p>`;
  const profileHandleBanner = ctx.displayHandle
    ? `<p class="clinical-teams-profile-handle">Visible en la red como <strong>@${escapeHtml(ctx.displayHandle)}</strong></p>`
    : '';

  return `
    <div class="clinical-teams-profile-panel clinical-teams-rank-section">
      <h5 class="clinical-teams-subsection-title">Mi perfil y rango</h5>
      ${legacyBanner}
      ${profileHandleBanner}
      ${lanDirectoryNote}
      <form id="clinical-profile-form" class="clinical-teams-create-form" novalidate>
        <div class="field-group">
          <label for="clinical-profile-username">Usuario LAN *</label>
          <input id="clinical-profile-username" type="text" class="profile-input"
            value="${escapeAttr(ctx.usernameForInput)}"
            placeholder="ej. drmendoza" autocomplete="off" spellcheck="false"
            pattern="[a-z][a-z0-9_]{2,31}" required>
          ${hintHtml('Usuario LAN (@usuario): minúsculas, sin espacios — p. ej. drmendoza. No es tu nombre en guardia.')}
        </div>
        <div class="field-group">
          <label for="clinical-profile-name">Nombre en guardia</label>
          <input id="clinical-profile-name" type="text" class="profile-input" value="${clinicalName}" required>
        </div>
        <div class="field-group">
          <label for="clinical-profile-rank">Rango clínico</label>
          <select id="clinical-profile-rank" class="profile-input">
            ${['R1', 'R2', 'R3', 'R4']
              .map(
                (r) =>
                  `<option value="${r}" ${r === ctx.rank ? 'selected' : ''}>${r}</option>`
              )
              .join('')}
          </select>
          ${hintHtml('Equipos, entregas y alcance clínico.')}
        </div>
        <div class="field-group">
          <label class="clinical-teams-guardia-label">
            <input type="checkbox" id="clinical-profile-admin" ${ctx.programAdmin ? 'checked' : ''}>
            <span>Privilegios de administración</span>
          </label>
          ${hintHtml('Requiere tu código al activar. Acceso total al programa: rotación, censo global y directorio LAN.')}
        </div>
        <div class="field-group">
          <label for="clinical-profile-sala">${ctx.programAdmin ? 'Mi sala (rango clínico)' : 'Sala'}</label>
          <select id="clinical-profile-sala" class="profile-input" required>
            <option value="">— Seleccionar —</option>
            ${CLINICAL_SALAS.map(
              (s) =>
                `<option value="${escapeAttr(s)}" ${ctx.sala === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
            ).join('')}
          </select>
          ${ctx.programAdmin ? hintHtml('Tu equipo y entregas usan esta sala; abajo puedes explorar otras.') : ''}
        </div>
        <div class="modal-actions clinical-teams-profile-save">
          <button type="submit" class="btn-save">Guardar perfil</button>
        </div>
      </form>
    </div>`;
}

export function buildJoinedTeamsSectionHtml(ctx, joinedHtml, lanMemberHint) {
  return `
    <section class="clinical-teams-section clinical-teams-section--joined">
      ${renderClinicalTeamsCollapsible({
        collapseKey: 'section.joined',
        defaultOpen: true,
        className: 'clinical-teams-collapse--section',
        summaryHtml: `
          <h4 class="clinical-teams-section-title">Mis equipos</h4>
          <p class="clinical-teams-section-desc">Equipos donde ya eres integrante.</p>`,
        bodyHtml: `${lanMemberHint}<div class="clinical-teams-list">${joinedHtml}</div>`,
      })}
    </section>`;
}

export function buildClinicalTeamsConfigSectionHtml(profileSection) {
  return `
    <section class="clinical-teams-section clinical-teams-section--more">
      ${renderClinicalTeamsCollapsible({
        collapseKey: 'section.config',
        defaultOpen: false,
        className: 'clinical-teams-collapse--section',
        summaryHtml: `
          <h4 class="clinical-teams-section-title">Configuración</h4>
          <p class="clinical-teams-section-desc">Perfil clínico y rango.</p>`,
        bodyHtml: `${profileSection}
      <details class="clinical-teams-advanced-rotation">
        <summary class="clinical-teams-advanced-rotation-summary">Zona avanzada · rotación del programa</summary>
        <div class="clinical-teams-advanced-rotation-body">
          <p class="clinical-teams-advanced-rotation-hint">Solo R4/Admin. Configura el calendario del ciclo o inicia una rotación nueva (archiva equipos y guardias del día).</p>
          <div class="clinical-teams-advanced-rotation-actions">
            <button type="button" id="btn-rotation-config-open" class="btn-med-secondary" hidden>Configuración rotación…</button>
            <button type="button" id="btn-nueva-rotacion" class="btn-med-secondary clinical-teams-nueva-rotacion-btn">Iniciar nueva rotación…</button>
          </div>
        </div>
      </details>`,
      })}
    </section>`;
}

export function buildJoinedTeamsEmptyHtml(displayHandle) {
  return `<p class="clinical-teams-empty clinical-teams-empty--section">Aún no perteneces a ningún equipo. ${displayHandle ? 'Pide que te agreguen con tu @usuario o ' : ''}explora equipos en tu sala abajo.</p>`;
}
