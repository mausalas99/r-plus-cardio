#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'public/js/features/clinical-teams');
const rosterPath = path.join(dir, 'teams-roster.mjs');
const lines = fs.readFileSync(rosterPath, 'utf8').split('\n');

// Split after renderClinicalTeamsPanelInto block (line 731 ends with `}`)
// LAN block starts renderLanUsersDirectoryEntryHtml ~771 in current file
const renderStart = lines.findIndex((l) => l.startsWith('function syncCreateTeamCycleField'));
const lanStart = lines.findIndex((l) => l.startsWith('function renderLanUsersDirectoryEntryHtml'));
const handlersStart = lines.findIndex((l) => l.startsWith('function wireBrowseSalaControl'));

if (renderStart < 0 || lanStart < 0 || handlersStart < 0) {
  console.error('split markers not found', { renderStart, lanStart, handlersStart });
  process.exit(1);
}

const headerEnd = renderStart;
const header = lines.slice(0, headerEnd).join('\n');

const renderBody = lines.slice(renderStart, lanStart).join('\n');
const lanBody = lines.slice(lanStart, handlersStart).join('\n');
const mainTail = lines.slice(handlersStart).join('\n');

const sharedImport = `import {
  clinicalSessionContext,
  fetchClinicalTeamsFromDb,
  refreshClinicalUserProfile,
} from '../../clinical-access-runtime.mjs';
import {
  isBenignLanPushSkipCode,
  LAN_PROFILE_PUSH_FAILED_MSG,
} from '../../clinical-profile-lan-sync.mjs';
import {
  getCycleLettersForTeamCreate,
  getCycleFieldMetaForTeamCreate,
  formatMemberCycleLabel,
  inferMembershipCycleForJoin,
  resolveMembershipCycleForUser,
} from '../../clinico-access.mjs';
import {
  buildClinicalTeamInviteMessage,
  teamInviteCode,
} from '../../clinical-team-invite.mjs';
import { copyToClipboardSafe } from '../soap-estado.mjs';
import {
  effectiveClinicalRank,
  hasElevatedTeamPrivileges,
  hasProgramAdminPrivileges,
  canViewLanUserDirectory,
  canManageTeamRoster,
  canDeleteLanDirectoryUser,
} from '../../clinical-privileges.mjs';
import {
  isLegacyMachineUsername,
  isValidUsernameFormat,
  normalizeUsername,
} from '../../clinical-username.mjs';
import { syncRotationConfigButton, wireNuevaRotacionControl } from '../clinical-rotation.mjs';
import { persistClinicalUserBinding, readRpcSettings } from '../../clinical-settings.mjs';
import { resumeClinicalIdentityByUsername } from '../../clinical-access-runtime.mjs';
import { verifyAdminAccessCode } from '../../../../lib/admin-access-code.mjs';
import {
  ensureClinicalPanelSession,
  getClinicalTeamsPanelHost,
  safeRenderClinicalTeamsPanel,
  setClinicalTeamsPanelError,
} from '../clinical-panel-host.mjs';
import {
  dbApi,
  toast,
  escapeHtml,
  escapeAttr,
  hintHtml,
  currentUserId,
  filterJoinedTeams,
  CLINICAL_TEAM_SERVICES,
  CLINICAL_SALAS,
  BROWSE_SALA_LS,
  adminAccessGrantedThisSession,
  verifiedAdminAccessCode,
  promptAdminAccessCode,
} from './shared.mjs';
import {
  publishClinicalTeamsToLan,
  toastTeamLanPublishResult,
  pullClinicalOpsFromLanRoom,
  resolveLocalUserIdByLanHandle,
} from './teams-guardia-bridge.mjs';
`;

const renderImports = `${sharedImport}
import { wireClinicalTeamsPanelInteractions, wireJoinButtons, wireCopyInviteButtons } from './teams-roster.mjs';
`;

const lanImports = `${sharedImport}
import { wireLanUsersDirectoryControls } from './teams-roster.mjs';
`;

const renderExports = `
export {
  syncCreateTeamCycleField,
  renderCreateTeamForm,
  renderClinicalTeamsPanel,
  renderClinicalTeamsPanelInto,
  tryReconcileTeamMemberships,
};
`;

const lanExports = `
export {
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  loadLanUsersDirectoryIntoHost,
};
`;

// Fix circular: render imports wire from main - use late binding
const renderFile = `/**
 * Mi rotación panel rendering.
 */
${sharedImport}

${renderBody.replace(/^function /gm, 'export function ').replace(/^async function renderClinicalTeamsPanel/gm, 'export async function renderClinicalTeamsPanel').replace(/^async function renderClinicalTeamsPanelInto/gm, 'export async function renderClinicalTeamsPanelInto').replace(/^async function tryReconcileTeamMemberships/gm, 'export async function tryReconcileTeamMemberships')}
`;

const lanFile = `/**
 * LAN users directory modal (Mi rotación).
 */
${sharedImport}

${lanBody
  .replace(/^function renderLanUsersDirectoryEntryHtml/gm, 'export function renderLanUsersDirectoryEntryHtml')
  .replace(/^function lanUsersModalBackdropEl/gm, 'export function lanUsersModalBackdropEl')
  .replace(/^function lanUsersModalBodyEl/gm, 'export function lanUsersModalBodyEl')
  .replace(/^async function openLanUsersDirectoryModal/gm, 'export async function openLanUsersDirectoryModal')
  .replace(/^export function closeLanUsersDirectoryModal/gm, 'export function closeLanUsersDirectoryModal')
  .replace(/^async function loadLanUsersDirectoryIntoHost/gm, 'export async function loadLanUsersDirectoryIntoHost')}
`;

// Main roster keeps open/close + handlers; re-export render/lan
const mainImports = `${sharedImport}
import {
  syncCreateTeamCycleField,
  renderCreateTeamForm,
  renderClinicalTeamsPanel,
  renderClinicalTeamsPanelInto,
} from './teams-roster-render.mjs';
import {
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  loadLanUsersDirectoryIntoHost,
  wireLanUsersDirectoryControls,
} from './teams-roster-lan.mjs';
`;

// Extract only open/close + handlers from header (before syncCreateTeamCycleField)
const mainHeader = header;

const mainFile = `/**
 * Mi rotación — panel open/close, handlers, wiring.
 */
${mainImports}

${mainHeader.split('\n').slice(59).join('\n')}

${mainTail}
`;

// wireLanUsersDirectoryControls stays in lan file - need to move it to lan body
// handlersStart was wireBrowseSalaControl - wireLanUsersDirectoryControls is before that in lan section

fs.writeFileSync(path.join(dir, 'teams-roster-render.mjs'), renderFile);
fs.writeFileSync(path.join(dir, 'teams-roster-lan.mjs'), lanFile);
fs.writeFileSync(path.join(dir, 'teams-roster.mjs'), mainFile);
console.log('roster split:', { render: renderFile.split('\n').length, lan: lanFile.split('\n').length, main: mainFile.split('\n').length });
