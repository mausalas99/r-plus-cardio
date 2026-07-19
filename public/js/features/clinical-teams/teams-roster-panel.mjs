/** Mi rotación — full panel render orchestration. */
import {
  clinicalSessionContext,
  fetchClinicalTeamsFromDb,
} from '../../clinical-access-runtime.mjs';
import { hasElevatedTeamPrivileges } from '../../clinical-privileges.mjs';
import {
  syncRotationConfigButton,
  wireNuevaRotacionControl,
  wireRotationConfigOpenControl,
} from '../clinical-rotation.mjs';
import { readRpcSettings } from '../../clinical-settings.mjs';
import {
  getClinicalTeamsPanelHost,
  safeRenderClinicalTeamsPanel,
  setClinicalTeamsPanelError,
} from '../clinical-panel-host.mjs';
import {
  dbApi,
  currentUserId,
  filterJoinedTeams,
} from './shared.mjs';
import { pullClinicalOpsFromLanRoom } from './teams-guardia-bridge.mjs';
import { wireLanUsersDirectoryControls } from './teams-roster-lan.mjs';
import { renderCreateTeamSectionHtml, renderJoinWithCodeSectionHtml } from './teams-roster-create.mjs';
import {
  resolveBrowseSala,
  renderDirectorySectionHtml,
  resolveLanTeamMemberHintHtml,
} from './teams-roster-directory.mjs';
import { renderJoinedTeamCard } from './teams-roster-team-cards.mjs';
import {
  resolveDisplayLanHandle,
  resolveClinicalTeamsPanelContext,
  buildClinicalTeamsHandleHint,
  buildClinicalProfileSectionHtml,
  buildJoinedTeamsSectionHtml,
  buildClinicalTeamsConfigSectionHtml,
  buildJoinedTeamsEmptyHtml,
} from './teams-roster-panel-build.mjs';
import {
  captureClinicalTeamsPanelDraft,
  restoreClinicalTeamsPanelDraft,
  isClinicalTeamsPanelUserInteracting,
} from './teams-roster-panel-draft.mjs';

/**
 * @param {{ silent?: boolean, skipLanPull?: boolean }} [opts]
 * — silent: sin pantalla «Cargando…» (actualización en caliente)
 * — skipLanPull: no GET al host (evita bucle con rpc-clinical-ops-synced)
 */
export async function renderClinicalTeamsPanel(opts = {}) {
  const silent = !!opts.silent;
  const skipLanPull = !!opts.skipLanPull || silent;
  if (silent) {
    const host = getClinicalTeamsPanelHost();
    if (!host) return;
    try {
      await renderClinicalTeamsPanelInto(host, {
        skipLanPull,
        preserveDraft: opts.preserveDraft !== false,
      });
    } catch (err) {
      console.error('[Mi rotación]', err);
      setClinicalTeamsPanelError(
        err instanceof Error ? err.message : 'Error al cargar Mi rotación.'
      );
    }
    return;
  }
  await safeRenderClinicalTeamsPanel(async (host) => {
    await renderClinicalTeamsPanelInto(host, { skipLanPull: false });
  });
}

export async function tryReconcileTeamMemberships() {
  const userId = currentUserId();
  const user = clinicalSessionContext.user;
  if (!userId || !user) return false;
  let joined = filterJoinedTeams(clinicalSessionContext.teams, user);
  if (joined.length) return false;

  const api = dbApi();
  if (!api || typeof api.dbClinicalMembershipMigrate !== 'function') return false;

  const settings = readRpcSettings();
  const fromUserId = String(settings.clinicalStaleDeviceUserId || '');
  if (!fromUserId || fromUserId === userId) return false;

  const res = await api.dbClinicalMembershipMigrate({ fromUserId, toUserId: userId });
  if (!res?.ok) return false;
  await fetchClinicalTeamsFromDb();
  joined = filterJoinedTeams(clinicalSessionContext.teams, user);
  return joined.length > 0;
}

export { resolveDisplayLanHandle };

async function maybePullClinicalOpsFromLan(skipLanPull) {
  if (skipLanPull) return;
  void pullClinicalOpsFromLanRoom({ timeoutMs: 12000 }).then((ok) => {
    const bd = document.getElementById('clinical-teams-backdrop');
    if (!ok || !bd?.classList.contains('open')) return;
    if (isClinicalTeamsPanelUserInteracting()) return;
    void renderClinicalTeamsPanel({ silent: true, skipLanPull: true, preserveDraft: true });
  });
}

export async function renderClinicalTeamsPanelInto(host, opts = {}) {
  const userId = currentUserId();
  if (!userId) {
    host.innerHTML =
      '<p class="clinical-teams-lead">Activa la sesión clínica para gestionar equipos.</p>';
    return;
  }

  const draft = opts.preserveDraft ? captureClinicalTeamsPanelDraft(host) : null;

  await maybePullClinicalOpsFromLan(opts.skipLanPull);
  await fetchClinicalTeamsFromDb();
  await tryReconcileTeamMemberships();
  const user = clinicalSessionContext.user || {};
  const joined = filterJoinedTeams(clinicalSessionContext.teams, user);
  const ctx = await resolveClinicalTeamsPanelContext(user, joined);
  const elevated = hasElevatedTeamPrivileges(user);

  const joinedHtml = joined.length
    ? joined.map((team) => renderJoinedTeamCard(team)).join('')
    : buildJoinedTeamsEmptyHtml(ctx.displayHandle);
  const profileSection = buildClinicalProfileSectionHtml(ctx, user);
  const browseSala = resolveBrowseSala(elevated, ctx.sala);
  const joinCodeSection = renderJoinWithCodeSectionHtml();
  const lanMemberHint = await resolveLanTeamMemberHintHtml(joined);
  const directorySection = await renderDirectorySectionHtml({
    userId,
    elevated,
    browseSala,
    homeSala: ctx.sala,
  });

  host.innerHTML = `
    ${buildClinicalTeamsHandleHint(ctx)}
    ${renderCreateTeamSectionHtml()}
    ${buildJoinedTeamsSectionHtml(ctx, joinedHtml, lanMemberHint)}
    ${directorySection}
    ${joinCodeSection}
    ${buildClinicalTeamsConfigSectionHtml(profileSection)}`;

  wireLanUsersDirectoryControls();
  syncRotationConfigButton();
  wireRotationConfigOpenControl(host);
  wireNuevaRotacionControl(host);
  const { wireRenderedClinicalTeamsPanel } = await import('./teams-roster-interactions.mjs');
  wireRenderedClinicalTeamsPanel(elevated);
  restoreClinicalTeamsPanelDraft(host, draft);
}
