import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFeatureSrc } from '../../../scripts/lib/read-feature-src.mjs';
import { filterJoinedTeams, CLINICAL_TEAM_SERVICES } from './clinical-teams.mjs';

const featureDir = join(dirname(fileURLToPath(import.meta.url)), 'clinical-teams');
const clinicalTeamsSrc = readFeatureSrc(featureDir, [
  'shared.mjs',
  'teams-roster.mjs',
  'teams-roster-shell.mjs',
  'teams-roster-manage.mjs',
  'teams-roster-profile.mjs',
  'teams-roster-profile-claim.mjs',
  'teams-roster-profile-persist.mjs',
  'teams-roster-submit.mjs',
  'teams-roster-render.mjs',
  'teams-roster-create.mjs',
  'teams-roster-team-cards.mjs',
  'teams-roster-directory.mjs',
  'teams-roster-panel.mjs',
  'teams-roster-panel-build.mjs',
  'teams-roster-panel-draft.mjs',
  'teams-roster-lan.mjs',
  'teams-roster-lan-dom.mjs',
  'teams-roster-lan-render.mjs',
  'teams-roster-lan-filters.mjs',
  'teams-roster-lan-state.mjs',
  'teams-roster-lan-load.mjs',
  'teams-roster-lan-modal.mjs',
  'teams-roster-lan-assign.mjs',
  'teams-roster-lan-wire.mjs',
  'teams-roster-lan-row-html.mjs',
  'teams-roster-interactions.mjs',
  'teams-roster-modal-chrome.mjs',
  'teams-invite.mjs',
  'teams-guardia-bridge.mjs',
  'index.mjs',
]);

describe('clinical-teams', () => {
  it('filterJoinedTeams returns teams where user is a member', () => {
    const teams = [
      {
        team_id: 't1',
        name: 'A',
        members: [{ user_id: 'u1', username: 'a' }],
      },
      {
        team_id: 't2',
        name: 'B',
        members: [{ user_id: 'u2', username: 'b' }],
      },
      {
        team_id: 't3',
        name: 'C',
        members: [{ user_id: 'u1', username: 'a' }, { user_id: 'u3', username: 'c' }],
      },
    ];
    const joined = filterJoinedTeams(teams, 'u1');
    assert.equal(joined.length, 2);
    assert.deepEqual(
      joined.map((t) => t.team_id),
      ['t1', 't3']
    );
  });

  it('filterJoinedTeams matches LAN username when user_id differs', () => {
    const teams = [
      {
        team_id: 't1',
        members: [{ user_id: 'ghost', username: 'msalas' }],
      },
    ];
    const joined = filterJoinedTeams(teams, { user_id: 'real', username: 'msalas' });
    assert.equal(joined.length, 1);
  });

  it('exports service enum', () => {
    assert.ok(CLINICAL_TEAM_SERVICES.includes('Sala'));
  });

  it('Mi rotación source has no per-team Guardia hoy checkbox', () => {
    assert.equal(clinicalTeamsSrc.includes('clinical-teams-guardia-check'), false);
    assert.equal(clinicalTeamsSrc.includes('Guardia hoy'), false);
    assert.equal(clinicalTeamsSrc.includes('handleGuardiaCheck'), false);
  });

  it('joined team card offers leave team for any member', () => {
    assert.match(clinicalTeamsSrc, /clinical-teams-leave-btn/);
    assert.match(clinicalTeamsSrc, /handleLeaveTeamClick/);
    assert.match(clinicalTeamsSrc, /dbClinicalTeamsMemberRemove/);
  });

  it('handleMyCycleSubmit publishes to LAN after cycle save', () => {
    const idx = clinicalTeamsSrc.indexOf('async function handleMyCycleSubmit');
    assert.ok(idx >= 0);
    const end = clinicalTeamsSrc.indexOf('async function resolveTeamIdForInviteInput', idx);
    const body = clinicalTeamsSrc.slice(idx, end > idx ? end : idx + 1200);
    assert.match(body, /publishClinicalTeamsToLan/);
    assert.match(body, /rpc-clinical-teams-changed/);
  });

  it('renderJoinedTeamCard defines user before cycle edit block', () => {
    const fnStart = clinicalTeamsSrc.indexOf('function renderJoinedTeamCard(team)');
    assert.ok(fnStart >= 0);
    const fnEnd = clinicalTeamsSrc.indexOf('\nfunction renderDirectoryTeamCard', fnStart);
    const fnBody = clinicalTeamsSrc.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2500);
    assert.match(fnBody, /const user = clinicalSessionContext\.user/);
    assert.match(fnBody, /renderMyCycleEditBlock\(team, user\)/);
  });

  it('Mi rotación opens LAN user directory in separate modal', () => {
    assert.match(clinicalTeamsSrc, /canViewLanUserDirectory/);
    assert.match(clinicalTeamsSrc, /openLanUsersDirectoryModal/);
    assert.match(clinicalTeamsSrc, /clinical-lan-users-backdrop/);
    assert.match(clinicalTeamsSrc, /renderLanUsersDirectoryTopButtonHtml/);
    assert.match(clinicalTeamsSrc, /clinical-teams-top-actions/);
    assert.match(clinicalTeamsSrc, /Directorio LAN/);
    assert.match(clinicalTeamsSrc, /getClinicalTeamsPanelHost\(\)[\s\S]*_rpcLanDirOpenDelegated/);
    assert.match(clinicalTeamsSrc, /clinical-lan-directory-open/);
    assert.match(clinicalTeamsSrc, /clinical-lan-rank-group/);
    assert.equal(clinicalTeamsSrc.includes('clinical-teams-lan-users-entry'), false);
    assert.equal(clinicalTeamsSrc.includes('section.lanUsers'), false);
  });

  it('elevated roster managers get empty team create flow', () => {
    assert.match(clinicalTeamsSrc, /canManageTeamRoster/);
    assert.match(clinicalTeamsSrc, /Crear equipo vacío/);
    assert.match(clinicalTeamsSrc, /clinical-lan-assign-btn/);
    assert.match(clinicalTeamsSrc, /clinical-lan-users-placement/);
    assert.match(clinicalTeamsSrc, /resolveMembershipCycleForUser/);
    assert.match(clinicalTeamsSrc, /rpc-clinical-ops-synced/);
  });

  it('silent Mi rotación refresh skips LAN pull to avoid ops-sync loop', () => {
    assert.match(clinicalTeamsSrc, /skipLanPull/);
    assert.match(clinicalTeamsSrc, /renderClinicalTeamsPanel\(\{ silent: true, skipLanPull: true/);
    assert.match(clinicalTeamsSrc, /isClinicalTeamsPanelUserInteracting/);
    assert.match(clinicalTeamsSrc, /captureClinicalTeamsPanelDraft/);
    assert.match(clinicalTeamsSrc, /restoreClinicalTeamsPanelDraft/);
    assert.match(clinicalTeamsSrc, /LAN_CLINICAL_OPS_PULL_MIN_MS/);
    assert.match(clinicalTeamsSrc, /opsSyncedTeamsRefreshTimer/);
  });

  it('elevated roster managers can edit and delete teams', () => {
    assert.match(clinicalTeamsSrc, /clinical-teams-edit-btn/);
    assert.match(clinicalTeamsSrc, /clinical-teams-delete-btn/);
    assert.match(clinicalTeamsSrc, /dbClinicalTeamsUpdate/);
    assert.match(clinicalTeamsSrc, /dbClinicalTeamsArchive/);
    assert.match(clinicalTeamsSrc, /clinical-teams-panel-body/);
    assert.match(clinicalTeamsSrc, /teamManageDelegationRoot/);
  });

  it('program admin checkbox requires access code', () => {
    assert.match(clinicalTeamsSrc, /wireAdminCheckboxGate/);
    assert.match(clinicalTeamsSrc, /verifyAdminAccessCode/);
    assert.match(clinicalTeamsSrc, /clinical-admin-code-backdrop/);
    assert.match(clinicalTeamsSrc, /promptAdminAccessCode/);
    assert.equal(clinicalTeamsSrc.includes('window.prompt('), false);
  });

  it('team join field redirects ⇄ sala links to Conexión guardia', () => {
    assert.match(clinicalTeamsSrc, /isLanSalaInvitePaste/);
    assert.match(clinicalTeamsSrc, /redirectLanInviteFromTeamJoinField/);
    assert.match(clinicalTeamsSrc, /joinLanFromInviteUi/);
  });

  it('Mi rotación sections and team cards use persisted collapsible blocks', () => {
    assert.match(clinicalTeamsSrc, /renderClinicalTeamsCollapsible/);
    assert.match(clinicalTeamsSrc, /clinical-teams-collapse/);
    assert.match(clinicalTeamsSrc, /data-collapse-key/);
    assert.match(clinicalTeamsSrc, /writeClinicalTeamsCollapseOpen/);
    assert.match(clinicalTeamsSrc, /wireClinicalTeamsCollapsePersistence/);
    assert.match(clinicalTeamsSrc, /section\.joined/);
    assert.match(clinicalTeamsSrc, /section\.directory/);
    assert.match(clinicalTeamsSrc, /card\.\$\{tid\}\.members/);
  });

  it('LAN directorio preserves collapsed rank groups across background refresh', () => {
    assert.match(clinicalTeamsSrc, /lanDirRt\.collapsedRanks/);
    assert.match(clinicalTeamsSrc, /lanDirRt\.expandedRanks/);
    assert.match(clinicalTeamsSrc, /shouldLanRankGroupOpen/);
    assert.match(clinicalTeamsSrc, /captureLanDirectoryCollapseState/);
    assert.match(clinicalTeamsSrc, /data-lan-rank-group/);
    assert.doesNotMatch(clinicalTeamsSrc, /clinical-lan-rank-group" open>/);
  });

  it('LAN directorio uses compact cards with search and filters', () => {
    assert.match(clinicalTeamsSrc, /clinical-lan-user-card/);
    assert.match(clinicalTeamsSrc, /clinical-lan-directory-toolbar/);
    assert.match(clinicalTeamsSrc, /applyLanDirectoryFilters/);
    assert.match(clinicalTeamsSrc, /bindLanDirectoryFilterControls/);
    assert.match(clinicalTeamsSrc, /ensureLanDirectoryFilterDelegation/);
    assert.match(clinicalTeamsSrc, /clinical-lan-directory-search/);
    assert.match(clinicalTeamsSrc, /clinical-lan-directory-activity-filter/);
    assert.match(clinicalTeamsSrc, /last_activity_at/);
    assert.match(clinicalTeamsSrc, /clinical-lan-user-activity-chip/);
  });

  it('LAN directorio freezes auto-refresh while open (manual Actualizar)', () => {
    assert.match(clinicalTeamsSrc, /lanDirRt\.freezeAutoRefresh/);
    assert.match(clinicalTeamsSrc, /refreshLanDirectoryFromHostUi/);
    assert.match(clinicalTeamsSrc, /clinical-lan-directory-refresh-btn/);
    assert.match(clinicalTeamsSrc, /buildLanDirectoryFingerprint/);
    assert.doesNotMatch(clinicalTeamsSrc, /rpc-clinical-ops-synced[\s\S]*scheduleLanDirectory/);
    assert.doesNotMatch(clinicalTeamsSrc, /setInterval[\s\S]*scheduleLanDirectory/);
  });
});
