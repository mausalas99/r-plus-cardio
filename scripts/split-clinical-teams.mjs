#!/usr/bin/env node
/**
 * One-shot split of clinical-teams.mjs into clinical-teams/ submodules (BN-07).
 */
import fs from 'fs';
import path from 'path';

const srcPath = path.join(process.cwd(), 'public/js/features/clinical-teams.mjs');
const outDir = path.join(process.cwd(), 'public/js/features/clinical-teams');
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function stripLeadingExport(s) {
  return s.replace(/^export /gm, '');
}

const headerComment = `/**
 * Mi rotación — self-serve teams and membership.
 */\n`;

const sharedImports = `import {
  clinicalSessionContext,
} from '../../clinical-access-runtime.mjs';
import { normalizeUsername } from '../../clinical-username.mjs';
import { verifyAdminAccessCode } from '../../../../lib/admin-access-code.mjs';
`;

const bridgeImports = `import {
  isBenignLanPushSkipCode,
  LAN_PROFILE_PUSH_FAILED_MSG,
} from '../../clinical-profile-lan-sync.mjs';
import { dbApi } from './shared.mjs';
`;

const inviteImports = `import {
  clinicalSessionContext,
  fetchClinicalTeamsFromDb,
} from '../../clinical-access-runtime.mjs';
import {
  buildClinicalTeamInviteMessage,
  diagnoseInviteCodeFailure,
  inviteCodeFailureMessage,
  isClinicalTeamJoinDesktopApp,
  normalizeTeamInviteCode,
  parseClinicalTeamJoinQuery,
  resolveTeamIdFromInviteCode,
  tryMountClinicalTeamInviteBrowserGate,
} from '../../clinical-team-invite.mjs';
import { copyToClipboardSafe } from '../soap-estado.mjs';
import { effectiveClinicalRank } from '../../clinical-privileges.mjs';
import {
  inferMembershipCycleForJoin,
} from '../../clinico-access.mjs';
import {
  ensureClinicalPanelSession,
} from '../clinical-panel-host.mjs';
import { dbApi, toast, currentUserId, filterJoinedTeams } from './shared.mjs';
import { publishClinicalTeamsToLan } from './teams-guardia-bridge.mjs';
import {
  openClinicalTeamsPanel,
  refreshTeamsUiAfterChange,
} from './teams-roster.mjs';
`;

const rosterImports = slice(4, 54).replace(
  /from '\.\//g,
  "from '../"
).replace(/from '\.\.\//g, "from '../../");

const indexImports = `import {
  closeClinicalTeamsPanel,
  closeLanUsersDirectoryModal,
  handleAddMemberSubmit,
  handleCreateTeamSubmit,
  handleEditTeamSubmit,
  handleJoinWithCodeSubmit,
  handleMyCycleSubmit,
  handleProfileFormSubmit,
  lanUsersModalBackdropEl,
  loadLanUsersDirectoryIntoHost,
  lanUsersModalBodyEl,
  openClinicalTeamsPanel,
  refreshTeamsUiAfterChange,
  renderClinicalTeamsPanel,
  teamsModalEl,
  wireClinicalTeamsPanelInteractions,
  wireLanUsersDirectoryControls,
} from './teams-roster.mjs';
import {
  adminCodeModalBackdropEl,
  cancelAdminCodeModal,
  wireAdminCodeModalControls,
} from './shared.mjs';
import { wireTeamManageModalDelegation } from './teams-roster.mjs';
`;

// --- shared.mjs ---
const sharedBody = stripLeadingExport(slice(56, 315));
const shared = `${headerComment}${sharedImports}
export ${sharedBody.split('\n').find((l) => l.startsWith('const CLINICAL')) ? '' : ''}
${sharedBody.replace(/^export const /gm, 'export const ').replace(/^export function /gm, 'export function ')}

// Fix: shared needs proper exports for constants
`;
// Rebuild shared more carefully
const sharedContent = `${headerComment}${sharedImports}
export const CLINICAL_TEAM_SERVICES = [
  'Sala',
  'Interconsultas',
  'Eme',
  'Torre HU',
  'UX',
  'Área A/Pensionistas',
];

export const CLINICAL_SALAS = ['Sala 1', 'Sala 2', 'Sala E'];

export const BROWSE_SALA_LS = 'clinical.browseSala';

/** @type {boolean} */
export let adminAccessGrantedThisSession = false;
/** @type {string|null} */
export let verifiedAdminAccessCode = null;
/** @type {((value: string|null) => void)|null} */
let adminCodePromptResolve = null;

${stripLeadingExport(slice(76, 193))}

${stripLeadingExport(slice(286, 315))}
`;

const bridgeContent = `${headerComment}${bridgeImports}
${stripLeadingExport(slice(194, 277))}
`;

const inviteContent = `${headerComment}${inviteImports}
${stripLeadingExport(slice(1972, 2027))}

${stripLeadingExport(slice(2334, 2475))}
`;

// roster: everything else - we'll build by removing known sections from full file
const excludeRanges = [
  [4, 55], // imports - replaced
  [56, 277], // shared + bridge
  [286, 315], // filter functions in shared
  [1972, 2027], // wire join/copy in invite
  [2334, 2475], // invite handlers
  [2481, 2593], // index wiring
];

function lineInRanges(lineNum, ranges) {
  return ranges.some(([a, b]) => lineNum >= a && lineNum <= b);
}

const rosterLines = [];
let inBlockComment = false;
for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  if (lineInRanges(lineNum, excludeRanges)) continue;
  rosterLines.push(lines[i]);
}

// Fix roster imports - use rosterImports at top
const rosterBody = rosterLines.join('\n');
const rosterContent =
  headerComment +
  rosterImports +
  '\nimport { dbApi, toast, escapeHtml, escapeAttr, hintHtml, currentUserId, filterJoinedTeams, isUserTeamMember, CLINICAL_TEAM_SERVICES, CLINICAL_SALAS, BROWSE_SALA_LS, adminAccessGrantedThisSession, verifiedAdminAccessCode, promptAdminAccessCode, finishAdminCodePrompt, closeAdminCodeModal } from \'./shared.mjs\';\n' +
  "import { publishClinicalTeamsToLan, toastTeamLanPublishResult, pullClinicalOpsFromLanRoom, resolveLocalUserIdByLanHandle } from './teams-guardia-bridge.mjs';\n" +
  "import { wireJoinButtons, wireCopyInviteButtons } from './teams-invite.mjs';\n\n" +
  rosterBody.replace(/^\/\*\*[\s\S]*?\*\/\n/, '').replace(/^import[\s\S]*?clinical-panel-host\.mjs';\n\n/, '');

// Export key roster symbols for index
const rosterExports = `
export {
  teamsModalEl,
  refreshTeamsUiAfterChange,
  handleProfileFormSubmit,
  handleCreateTeamSubmit,
  handleAddMemberSubmit,
  handleMyCycleSubmit,
  handleEditTeamSubmit,
  wireLanUsersDirectoryControls,
  wireTeamManageModalDelegation,
  lanUsersModalBackdropEl,
  lanUsersModalBodyEl,
  loadLanUsersDirectoryIntoHost,
};
`;

// Append exports at end of roster - actually they should already be exported in body
const indexContent = `${headerComment}
export {
  CLINICAL_TEAM_SERVICES,
  CLINICAL_SALAS,
  filterJoinedTeams,
  isUserTeamMember,
} from './shared.mjs';

export {
  openClinicalTeamsPanel,
  closeClinicalTeamsPanel,
  renderCreateTeamForm,
  renderClinicalTeamsPanel,
  openLanUsersDirectoryModal,
  closeLanUsersDirectoryModal,
  wireClinicalTeamsPanelInteractions,
} from './teams-roster.mjs';

export { consumeClinicalTeamJoinFromUrl } from './teams-invite.mjs';

${indexImports}

${stripLeadingExport(slice(2481, 2593))}
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'shared.mjs'), sharedContent);
fs.writeFileSync(path.join(outDir, 'teams-guardia-bridge.mjs'), bridgeContent);
fs.writeFileSync(path.join(outDir, 'teams-invite.mjs'), inviteContent);
fs.writeFileSync(path.join(outDir, 'teams-roster.mjs'), rosterContent);
fs.writeFileSync(path.join(outDir, 'index.mjs'), indexContent);

const barrel = `export * from './clinical-teams/index.mjs';\n`;
fs.writeFileSync(srcPath, barrel);

console.log('Split complete:', outDir);
