#!/usr/bin/env node
/**
 * One-shot splitter for transport.mjs and pase-board.mjs → submodules + facades.
 * Run from repo root: node scripts/tmp/split-transport-pase.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

function sliceLines(text, start, end) {
  const lines = text.split('\n');
  return lines.slice(start - 1, end).join('\n');
}

// ─── transport.mjs ───────────────────────────────────────────────────────────
const transportSrc = read('public/js/features/lan/transport.mjs');

const transportDeps = `/**
 * LAN transport DI wiring (esbuild may duplicate transport across chunks).
 */
${sliceLines(transportSrc, 75, 140)}
`;

const transportSession = `/**
 * LAN client config, bearer alignment, and authenticated fetch.
 */
import { storage } from '../../storage.js';
import { rememberPrimaryHostUrl, pingLanHostUrl } from '../../lan-surrogate-host.mjs';
import { getPinnedHostUrl } from '../../lan-host-pin.mjs';
import { lanClient, activeLiveSyncRoomId } from './runtime.mjs';
import { getRoomSyncPhase, RoomSyncPhase } from '../../lan-sync-state.mjs';
import { isClinicalLocalOnlyMode, readRpcSettings } from '../../clinical-settings.mjs';
import { canLocalMacBeLanHost } from '../../lan-host-rank-policy.mjs';
import { deps, runtime } from './transport-deps.mjs';

${sliceLines(transportSrc, 143, 155)}

${sliceLines(transportSrc, 189, 191)}

${sliceLines(transportSrc, 193, 342)}

${sliceLines(transportSrc, 522, 562)}

${sliceLines(transportSrc, 1155, 1201)}
`;

const transportHostUrl = `/**
 * LAN host URL resolution for share, pin, and auto-detect.
 */
import { storage } from '../../storage.js';
import { buildLanJoinUrls } from '../../lan-join-link.mjs';
import {
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLocalLoopbackLanUrl,
  isLanSessionConfiguredForRest,
  trimStoredLanBearer,
  resolveHostBearerToken,
} from './transport-session.mjs';
import { lanClient, activeLiveSyncRoomId } from './runtime.mjs';
import { getRoomSyncPhase, RoomSyncPhase } from '../../lan-sync-state.mjs';
import { isClinicalLocalOnlyMode, readRpcSettings } from '../../clinical-settings.mjs';
import { canLocalMacBeLanHost } from '../../lan-host-rank-policy.mjs';
import { normalizeLanHostBase, lanHostBasesSameMachine } from '../../lan-host-subnet-discovery.mjs';

${sliceLines(transportSrc, 568, 649)}

export async function buildShareJoinUrl(hostUrl, ticketId, teamCode) {
  const urls = await buildLanJoinUrls(hostUrl, ticketId, teamCode);
  return urls.joinUrl;
}

export async function resolveLanHostUrlAuto() {
  var shareUrl = await resolveLanShareBaseUrl();
  if (shareUrl) return shareUrl;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var fromCfg = String(cfg.hostUrl || '')
    .trim()
    .replace(/\\/+$, '');
  if (fromCfg) return fromCfg;
  if (!isLanElectronDesktop()) return '';
  return 'http://127.0.0.1:3738';
}

/** True when REST hostUrl is this Mac (split-brain: live locally but not on ward host). */
export async function isLanRestHostOwnMachine() {
  if (!isLanSessionConfiguredForRest()) return false;
  var cfg = typeof storage.getLanConfig === 'function' ? storage.getLanConfig() || {} : {};
  var restHost = normalizeLanHostBase(String(cfg.hostUrl || '').trim());
  if (!restHost) return false;
  var own = normalizeLanHostBase((await resolveOwnLanBaseForPin()) || '');
  if (!own) return false;
  return lanHostBasesSameMachine(restHost, own) || restHost === own;
}

export async function resolveLanTeamCodeForShare() {
  var cfg = typeof storage.getLanConfig === 'function' ? (storage.getLanConfig() || {}) : {};
  var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : 'client';
  if (uiRole === 'host') {
    var hostBearer = await resolveHostBearerToken();
    if (hostBearer) return hostBearer;
  }
  var teamInput = document.getElementById('lan-input-team-code');
  var fromInput = teamInput && teamInput.value != null ? String(teamInput.value).trim() : '';
  if (fromInput) return fromInput;
  return trimStoredLanBearer(cfg.teamCode);
}

export async function resolveLanHostUrlForShare() {
  return resolveLanShareBaseUrl();
}

${sliceLines(transportSrc, 167, 187)}
`;

const transportPairing = `/**
 * LAN pairing tickets, migration notice, and invite exchange.
 */
import { buildTeamHash } from '../../lan-join-link.mjs';
import { isMobileWeb } from '../../mobile-web.mjs';
import { appendMobileSharerParamsToJoinUrl } from '../../mobile-sharer-sync.mjs';
import {
  recordWardHostUrl,
  mergeWardHostRegistry,
} from '../../lan-ward-host-registry.mjs';
import { getLanClientId, lanClient } from './runtime.mjs';
import { resolveLanJoinHostUrl } from '../../lan-join-link.mjs';
import { deps, runtime, esc } from './transport-deps.mjs';
import {
  trimStoredLanBearer,
  lanFetchAuthed,
  resolveHostBearerToken,
  getLanTeamCodeFromConfig,
  isLanSessionConfiguredForRest,
} from './transport-session.mjs';
import {
  buildShareJoinUrl,
  resolveLanShareBaseUrl,
  resolveLanHostUrlForShare,
  resolveLanTeamCodeForShare,
} from './transport-host-url.mjs';
import { configureLanFromMobileJoin } from './transport-mobile.mjs';

const LAN_MIGRATION_NOTICE_KEY = 'rplus.lan.migrationNoticeShown';
let _lastLanPairing = null;

${sliceLines(transportSrc, 344, 424)}

${sliceLines(transportSrc, 467, 519)}

${sliceLines(transportSrc, 1202, 1238)}

${sliceLines(transportSrc, 1350, 1447)}
`;

const transportMobile = `/**
 * Mobile LAN join, sharer sync, and guest bearer persistence.
 */
import { storage } from '../../storage.js';
import { isMobileWeb } from '../../mobile-web.mjs';
import { restoreMobilePairingFromStorage } from '../../mobile-lan-query-persist.mjs';
import {
  applyMobileSharerContextFromUrl,
  hydrateMobileSharerSessionFromSettings,
  mobileSharerDisplayLabel,
} from '../../mobile-sharer-sync.mjs';
import { rememberPrimaryHostUrl } from '../../lan-surrogate-host.mjs';
import { resolveLanJoinHostUrl, liveSyncRoomLabel } from '../../lan-join-link.mjs';
import { lanClient } from './runtime.mjs';
import { deps, runtime } from './transport-deps.mjs';
import {
  trimStoredLanBearer,
  isLanElectronDesktop,
  isLanSessionConfiguredForRest,
  isLocalLoopbackLanUrl,
} from './transport-session.mjs';
import { maybeShowLanMigrationNotice } from './transport-pairing.mjs';

${sliceLines(transportSrc, 441, 454)}

async function persistGuestBearerFromExchange(data) {
  if (!data || !data.persist || data.storageTarget !== 'userData') return;
  if (!window.electronAPI || typeof window.electronAPI.lanGuestWriteBearer !== 'function') return;
  var token = trimStoredLanBearer(data.token);
  if (!token) return;
  try {
    await window.electronAPI.lanGuestWriteBearer({ token: token });
  } catch (_e) {}
  if (data.clientToken) {
    try {
      localStorage.setItem('rpc-lan-client-token', String(data.clientToken));
    } catch (_eCt) {}
  }
}

async function verifyTeamHashFromUrl(joinUrl, ownTeamCode) {
  try {
    const urlTh = new URL(joinUrl).searchParams.get('th');
    if (!urlTh) return true;
    const expectedTh = await buildTeamHash(ownTeamCode);
    return !expectedTh || urlTh === expectedTh;
  } catch (_e) {
    return true;
  }
}

${sliceLines(transportSrc, 1243, 1344)}
`;

// Fix transportMobile - add buildTeamHash import
const transportMobileFixed = transportMobile.replace(
  "import { resolveLanJoinHostUrl, liveSyncRoomLabel } from '../../lan-join-link.mjs';",
  "import { resolveLanJoinHostUrl, liveSyncRoomLabel, buildTeamHash } from '../../lan-join-link.mjs';"
);

// Circular dep: pairing imports mobile, mobile imports pairing for maybeShowLanMigrationNotice
// Break cycle: move maybeShowLanMigrationNotice to transport-pairing only, mobile imports it - 
// pairing imports configureLanFromMobileJoin from mobile - CYCLE
// Fix: put exchangeLanJoinFromInvite in transport-mobile.mjs instead, or use dynamic import
// Better: put configureLanFromMobileJoin and exchange in same module (transport-join.mjs)

const transportHostElection = `/**
 * LAN host election, pin override, promotion, and auto-join.
 */
import { storage } from '../../storage.js';
import { rememberPrimaryHostUrl, pingLanHostUrl, listLivePeerHostUrls } from '../../lan-surrogate-host.mjs';
import {
  getPinnedHostUrl,
  hasPinnedHostOverride,
  isPinnedHostLocal,
} from '../../lan-host-pin.mjs';
import { lanHostBasesSameMachine, normalizeLanHostBase } from '../../lan-host-subnet-discovery.mjs';
import { discoverLanHostsConcurrent } from '../../lan-discovery.mjs';
import {
  recordWardHostUrl,
  syncWardHostUrlToMainFile,
} from '../../lan-ward-host-registry.mjs';
import {
  recordAutoHostDetectSuccess,
  resumeAutoHostDetect,
} from '../../lan-host-detect-guard.mjs';
import { isWardTierHostMeta, markWardTierHostSeen } from '../../lan-host-escalation.mjs';
import { buildLocalLanHostMeta, prefersLanClientDiscoveryFirst } from '../../lan-host-rank.mjs';
import {
  canLocalMacBeLanHost,
  evaluatePeerHostAction,
  fetchLanHostRank,
  getLocalLanHostMeta,
  isClinicalRankConfiguredForLan,
  pickPreferredLanPeerHost,
  prefersLanHosting,
  resolveHostElection,
  syncLanHostClinicalMetaToDisk,
} from '../../lan-host-rank-policy.mjs';
import {
  pushBundleToHostUrl as pushBundleToHostUrlCore,
  runConsolidateIntoHost,
} from '../../lan-host-consolidation.mjs';
import {
  lanClient,
  clearActiveLiveSyncRoom,
  getLanClientId,
} from './runtime.mjs';
import { clearRoomMembership } from '../../live-sync-membership.mjs';
import { deps, runtime } from './transport-deps.mjs';
import {
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLocalLoopbackLanUrl,
  persistLanClientConfig,
  syncLanSavedTeamCodeWithEffectiveHostCode,
  resolveHostBearerToken,
  getLanTeamCodeFromConfig,
  applyLanHostUrlSwitch,
  maybeApplyLanHostUrlSwitch,
} from './transport-session.mjs';
import {
  resolveLanShareBaseUrl,
  resolveLanHostUrlAuto,
  resolveOwnLanBaseForPin,
} from './transport-host-url.mjs';

const LAN_CONSOLIDATE_COOLDOWN_MS = 10 * 60 * 1000;
/** @type {Map<string, number>} */
const _lanDeclinedConsolidateUntil = new Map();
let _lanSplitBrainWarned = false;

${sliceLines(transportSrc, 651, 1141)}

export { syncLanHostClinicalMetaToDisk } from '../../lan-host-rank-policy.mjs';
`;

const transportInit = `/**
 * Boot LAN client from persisted rpc-lan-config.
 */
import { storage } from '../../storage.js';
import { isMobileWeb } from '../../mobile-web.mjs';
import { restoreMobilePairingFromStorage } from '../../mobile-lan-query-persist.mjs';
import { liveSyncRoomLabel } from '../../lan-join-link.mjs';
import { lanClient } from './runtime.mjs';
import { getRoomMembership } from '../../live-sync-membership.mjs';
import { deps, ensureLanSyncTransportDepsWired } from './transport-deps.mjs';
import { persistLanClientConfig, isLanElectronDesktop } from './transport-session.mjs';
import { fixMobileLanHostUrl } from './transport-mobile.mjs';

${sliceLines(transportSrc, 1449, 1479)}
`;

const transportFacade = `/**
 * LAN HTTP transport, pairing, and host URL resolution (IM-11) — public façade.
 */
export { registerLanSyncTransportDeps, ensureLanSyncTransportDepsWired } from './transport-deps.mjs';

export {
  trimStoredLanBearer,
  isLanSessionConfiguredForRest,
  persistLanClientConfig,
  ensureLanClientTeamCodeAligned,
  ensureLanGuestBearerFileFromConfig,
  syncLanGuestBearerFromDisk,
  lanFetchAuthed,
  resolveHostBearerToken,
  syncLanSavedTeamCodeWithEffectiveHostCode,
  isLanElectronDesktop,
  isLanRemoteJoinMode,
  isLocalLoopbackLanUrl,
  getLanTeamCodeFromConfig,
  applyLanHostUrlSwitch,
  maybeApplyLanHostUrlSwitch,
} from './transport-session.mjs';

export {
  isLanRestHostOwnMachine,
  shouldShowLanShiftPinClientConnect,
  shouldShowLanShiftPinHostDisplay,
  resolveLanShareBaseUrl,
  buildShareJoinUrl,
  resolveLanHostUrlAuto,
  resolveOwnLanBaseForPin,
  resolveLanTeamCodeForShare,
  resolveLanHostUrlForShare,
} from './transport-host-url.mjs';

export {
  mintLanPairingTicket,
  maybeShowLanMigrationNotice,
  exchangeLanJoinFromInvite,
  formatLanTicketExpiryLabel,
  lanTicketExpirySoon,
  ensureLanPairingForShare,
  getLastLanPairing,
  updateLanPairingDisplay,
  mintLanPairingFromUi,
} from './transport-pairing.mjs';

export {
  syncMobileWithSharedInvite,
  resumeMobileLanRoomJoin,
  configureLanFromMobileJoin,
} from './transport-mobile.mjs';

export {
  applyPinnedHostOverride,
  ensureLanElectronHostReady,
  pushBundleToHostUrl,
  consolidateIntoHost,
  reactToDiscoveredLanHost,
  promoteThisMacToLanHost,
  syncLanHostClinicalMetaToDisk,
  tryConnectToPinnedHost,
  tryAutoJoinPreferredLanHost,
  joinRemoteLanHostAsClient,
  initLanHostPlugAndPlay,
} from './transport-host-election.mjs';

export { initLanClientFromStorage } from './transport-init.mjs';
`;

// Fix transport-deps to export deps, runtime, esc
const transportDepsFixed = transportDeps.replace(
  'function deps() {',
  'export function deps() {'
).replace(
  'function runtime() {',
  'export function runtime() {'
).replace(
  'function esc(s) {',
  'export function esc(s) {'
);

// Fix transportSession - remove isLanRestHostOwnMachine block (lines 156-165), add import
// Fix shouldShowLanShiftPinClientConnect to use imported isLanRestHostOwnMachine

// Fix transport-pairing - remove duplicate persistGuestBearer and fixMobile from slice if included
// exchange uses configureLanFromMobileJoin - pairing imports mobile, mobile imports pairing - BREAK CYCLE
// Solution: dynamic import in pairing for configureLanFromMobileJoin OR merge exchange into mobile

write('public/js/features/lan/transport-deps.mjs', transportDepsFixed);
write('public/js/features/lan/transport-session.mjs', transportSession);
write('public/js/features/lan/transport-host-url.mjs', transportHostUrl);
write('public/js/features/lan/transport-host-election.mjs', transportHostElection);
write('public/js/features/lan/transport-init.mjs', transportInit);

// Break pairing<->mobile cycle: pairing uses dynamic import for configureLanFromMobileJoin
let pairingFixed = transportPairing.replace(
  "import { configureLanFromMobileJoin } from './transport-mobile.mjs';\n",
  ''
).replace(
  'configureLanFromMobileJoin(joinedUrl, data.token, roomId);',
  "const { configureLanFromMobileJoin } = await import('./transport-mobile.mjs');\n  configureLanFromMobileJoin(joinedUrl, data.token, roomId);"
);

// Remove duplicate helpers from pairing slice (persistGuestBearer, fixMobile, verifyTeamHash were in 426-465)
write('public/js/features/lan/transport-pairing.mjs', pairingFixed);
write('public/js/features/lan/transport-mobile.mjs', transportMobileFixed);
write('public/js/features/lan/transport.mjs', transportFacade);

console.log('transport split written');

// ─── pase-board.mjs ──────────────────────────────────────────────────────────
const paseSrc = read('public/js/features/pase-board.mjs');

const paseRuntime = `/**
 * Pase board runtime DI (registered from app-runtimes).
 */
${sliceLines(paseSrc, 274, 325)}
`;

const paseInnerCache = `/**
 * Expediente inner-tab render cache, warm-up, and preload.
 */
import { storage } from '../storage.js';
import { medRecetaByPatient } from '../app-state.mjs';
import { isModeSala } from '../mode-features.mjs';
import { buildEaMonitoreoRevision } from './estado-actual-data.mjs';
import { getLabHistoryRevision } from '../lab-history-cache.mjs';
import { scheduleIdle } from '../deferred-work.mjs';
import {
  consolidatedTabForGranular,
  defaultGranularForConsolidatedTab,
  migrateGranularInner,
} from '../expediente-tabs.mjs';
import { rt } from './pase-board-runtime.mjs';

${sliceLines(paseSrc, 89, 272)}
`;

const paseRender = `/**
 * Vista Pase board DOM render (resumen del paciente).
 */
import { renderEntry, isLabSectionHeaderHtml } from '../labs.js';
import { storage } from '../storage.js';
import { sortLabHistoryChronological } from '../tend-core.mjs';
import { dosisBeforeSlash, effectiveDiaTratamiento } from '../med-receta-core.mjs';
import { patients, medRecetaByPatient } from '../app-state.mjs';
import { isPaseMode } from './chrome.mjs';
import {
  extractCultivoTableRowsFromHistory,
  filterCultivoRowsSignificantFlip,
  paseCultivoAtbBlockHtml,
  removeAtbRisPanelsFromBody,
  wireAtbRisHoverPanels,
} from './expediente.mjs';
import { todoCompareForSort, toggleTodo } from './todos.mjs';
import { rt } from './pase-board-runtime.mjs';
import { buildPaseBoardCacheKey, invalidatePaseBoardCache } from './pase-board-cache-keys.mjs';

${sliceLines(paseSrc, 327, 499)}

${sliceLines(paseSrc, 501, 743)}
`;

// Need cache key module separate from inner cache to avoid pase-render importing inner cache circularly
const paseCacheKeys = `/**
 * Pase board summary cache key (invalidation).
 */
import { storage } from '../storage.js';
import { medRecetaByPatient } from '../app-state.mjs';
import { getLabHistoryRevision } from '../lab-history-cache.mjs';
import { rt } from './pase-board-runtime.mjs';

var _paseBoardCacheKey = '';

export function invalidatePaseBoardCache() {
  _paseBoardCacheKey = '';
}

export function buildPaseBoardCacheKey(pid) {
  var todos = storage.getTodos(pid);
  var done = 0;
  for (var i = 0; i < todos.length; i += 1) {
    if (todos[i].completed) done += 1;
  }
  var med = (medRecetaByPatient[pid] && medRecetaByPatient[pid].items) || [];
  var ag = getPaseAgendaForPatient(pid);
  return (
    String(pid) +
    '|L' +
    getLabHistoryRevision(pid) +
    '|T' +
    todos.length +
    ':' +
    done +
    '|M' +
    med.length +
    '|A' +
    ag.length
  );
}

export function getPaseBoardCacheKey() {
  return _paseBoardCacheKey;
}

export function setPaseBoardCacheKey(key) {
  _paseBoardCacheKey = key;
}

function getPaseAgendaForPatient(patientId) {
  var cutoff = Date.now() - 3600000;
  return storage
    .getScheduledProcedures()
    .filter(function (ev) {
      return String(ev.patientId) === String(patientId);
    })
    .filter(function (ev) {
      var t = Date.parse(ev.start);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort(function (a, b) {
      return Date.parse(a.start) - Date.parse(b.start);
    })
    .slice(0, 12);
}
`;

const paseNavigation = `/**
 * App tab and expediente inner-tab navigation.
 */
import { storage } from '../storage.js';
import { isPaseMode, isGuardiaMode, getUiDensity, setUiDensity, markOpenedDetailFromPaseBoard } from './chrome.mjs';
import { renderGuardiaBoard } from './guardia-board.mjs';
import { isModeSala } from '../mode-features.mjs';
import {
  renderPatientDataPane,
  renderCultivosTable,
  renderListadoForm,
} from './expediente.mjs';
import { renderTodoForm } from './todos.mjs';
import { renderNoteForm, renderIndicaForm } from './notes-indicaciones.mjs';
import {
  renderHistoriaClinicaPanel,
  invalidateHistoriaClinicaPanel,
} from './historia-clinica-panel.mjs';
import {
  renderEventualidadesPanel,
  invalidateEventualidadesPanel,
} from './eventualidades-panel.mjs';
import { renderVpo } from './vpo.mjs';
import { resumeLabBulkPreviewModalIfSuspended } from './lab-bulk-preview-modal.mjs';
import {
  eaHasCopyableContent,
  invalidateEaPanelCache,
  renderEstadoActualPanel,
  syncEaCopyFab,
} from './estado-actual-panel.mjs';
import {
  ensureChartsLoaded,
  ensureLabsLoaded,
  hideLabPanelLoadingSkeleton,
  showLabPanelLoadingSkeleton,
} from '../lazy-feature-routes.mjs';
import { renderRecetaHu } from './receta-hu.mjs';
import { scrollActiveRondaCardIntoView, setRoundOverviewMode, syncRoundExpedienteLayout } from './patients.mjs';
import { renderEstadoActualBar } from './soap-estado.mjs';
import {
  animateTabPanelEnter,
  hideAppTabPanel,
  showAppTabPanel,
  syncAppTabIndicator,
  syncInnerTabIndicator,
  syncExpedienteSegmentIndicators,
  syncAllSubTabIndicators,
} from '../ui-tab-motion.mjs';
import {
  applyExpedientePaneLayout,
  consolidatedInnerTabButtonId,
  defaultGranularForConsolidatedTab,
  isClinicoCompositeVisible,
  migrateGranularInner,
  resetExpedientePaneLayoutCache,
  syncConsolidatedPaneVisibility,
  syncConsolidatedSegmentBars,
} from '../expediente-tabs.mjs';
import { closePatientDatosModal, wirePatientDatosModalOnce } from '../patient-datos-modal.mjs';
import { isMobileWeb } from '../mobile-web.mjs';
import {
  renderExpedienteGroupRow,
  wireGroupRowBreakpointResync,
} from './expediente-group-row-ui.mjs';
import { syncHeaderContext } from './header-context.mjs';
import { cancelDeferredIdleWork, scheduleAfterPaint } from '../deferred-work.mjs';
import { rt } from './pase-board-runtime.mjs';
import { renderPaseBoard } from './pase-board-render.mjs';
import {
  cancelExpedienteWarm,
  warmExpedienteHeavyTabs,
  initExpedienteTabPreload,
  invalidateInnerTabRenderCache,
  renderGranularInnerTab,
  isInnerTabContentFresh,
  granularMountIsEmpty,
  expedienteCompositeTab,
} from './pase-board-inner-cache.mjs';
import { invalidatePaseBoardCache } from './pase-board-cache-keys.mjs';

${sliceLines(paseSrc, 745, 782)}

${sliceLines(paseSrc, 784, 794)}

${sliceLines(paseSrc, 796, 946)}

${sliceLines(paseSrc, 948, 1038)}

${sliceLines(paseSrc, 1040, 1072)}

${sliceLines(paseSrc, 1074, 1340)}
`;

const paseFacade = `/**
 * Vista Pase (resumen) y navegación de pestañas principales / internas — façade.
 */
export { initTabBarMotion } from '../ui-tab-motion.mjs';

export { registerPaseBoardRuntime, rt } from './pase-board-runtime.mjs';

export {
  invalidateInnerTabRenderCache,
  cancelExpedienteWarm,
  warmExpedienteHeavyTabs,
  initExpedienteTabPreload,
} from './pase-board-inner-cache.mjs';

export { renderPaseBoard } from './pase-board-render.mjs';
export { invalidatePaseBoardCache } from './pase-board-cache-keys.mjs';

export {
  openPaseSectionInNormal,
  switchAppTab,
  syncMainAppTabA11y,
  syncInnerTabVisualOnly,
  refreshExpedienteForAppModeChange,
  refreshExpedienteAfterPatientSelect,
  switchConsolidatedTab,
  switchInnerTab,
  renderInnerTabs,
  getActiveInnerTab,
  windowHandlers,
} from './pase-board-navigation.mjs';
`;

// Fix pase-runtime to export rt
const paseRuntimeFixed = paseRuntime.replace('var rt = {', 'export var rt = {');

// Fix pase-inner-cache - export functions used by navigation, remove buildPaseBoardCacheKey (moved)
let innerCacheFixed = paseInnerCache
  .replace(
    sliceLines(paseSrc, 178, 199),
    ''
  )
  .replace(
    'function buildPaseBoardCacheKey(pid)',
    'export function buildPaseBoardCacheKey_REMOVED'
  );

// Re-read and manually fix inner cache - the slice 89-272 includes buildPaseBoardCacheKey and getPaseAgenda
// Let me rebuild inner cache properly
const innerCacheBody = sliceLines(paseSrc, 89, 177) + '\n' + sliceLines(paseSrc, 200, 272);
const paseInnerCacheFixed = `/**
 * Expediente inner-tab render cache, warm-up, and preload.
 */
import { storage } from '../storage.js';
import { isModeSala } from '../mode-features.mjs';
import { buildEaMonitoreoRevision } from './estado-actual-data.mjs';
import { medRecetaByPatient } from '../app-state.mjs';
import { getLabHistoryRevision } from '../lab-history-cache.mjs';
import { scheduleIdle } from '../deferred-work.mjs';
import {
  consolidatedTabForGranular,
  defaultGranularForConsolidatedTab,
  migrateGranularInner,
} from '../expediente-tabs.mjs';
import {
  renderEstadoActualPanel,
} from './estado-actual-panel.mjs';
import { renderVpo } from './vpo.mjs';
import { ensureChartsLoaded } from '../lazy-feature-routes.mjs';
import { renderNoteForm, renderIndicaForm } from './notes-indicaciones.mjs';
import {
  renderHistoriaClinicaPanel,
} from './historia-clinica-panel.mjs';
import { renderEventualidadesPanel } from './eventualidades-panel.mjs';
import {
  renderPatientDataPane,
  renderCultivosTable,
  renderListadoForm,
} from './expediente.mjs';
import { renderTodoForm } from './todos.mjs';
import { renderRecetaHu } from './receta-hu.mjs';
import { rt } from './pase-board-runtime.mjs';

${innerCacheBody}

${sliceLines(paseSrc, 1084, 1146)}
`;

// Fix pase-render cache key state
let paseRenderFixed = paseRender
  .replace(
    "import { buildPaseBoardCacheKey, invalidatePaseBoardCache } from './pase-board-cache-keys.mjs';",
    "import { buildPaseBoardCacheKey, getPaseBoardCacheKey, setPaseBoardCacheKey } from './pase-board-cache-keys.mjs';"
  )
  .replace(/_paseBoardCacheKey/g, '__PASE_CACHE_KEY__');
paseRenderFixed = paseRenderFixed
  .replace(/if \(__PASE_CACHE_KEY__ === cacheKey/g, 'if (getPaseBoardCacheKey() === cacheKey')
  .replace(/__PASE_CACHE_KEY__ = cacheKey;/g, 'setPaseBoardCacheKey(cacheKey);')
  .replace(/__PASE_CACHE_KEY__ = "";/g, 'setPaseBoardCacheKey("");');

// Fix pase-navigation - add windowHandlers at end, export refresh functions
let paseNavFixed = paseNavigation + `
import { initTabBarMotion } from '../ui-tab-motion.mjs';

export const windowHandlers = {
  switchAppTab,
  openPaseSectionInNormal,
  renderPaseBoard,
  switchInnerTab,
  switchConsolidatedTab,
  initTabBarMotion,
};
`;

write('public/js/features/pase-board-runtime.mjs', paseRuntimeFixed);
write('public/js/features/pase-board-cache-keys.mjs', paseCacheKeys);
write('public/js/features/pase-board-inner-cache.mjs', paseInnerCacheFixed);
write('public/js/features/pase-board-render.mjs', paseRenderFixed);
write('public/js/features/pase-board-navigation.mjs', paseNavFixed);
write('public/js/features/pase-board.mjs', paseFacade);

console.log('pase-board split written');

// Line counts
for (const f of [
  'public/js/features/lan/transport-deps.mjs',
  'public/js/features/lan/transport-session.mjs',
  'public/js/features/lan/transport-host-url.mjs',
  'public/js/features/lan/transport-pairing.mjs',
  'public/js/features/lan/transport-mobile.mjs',
  'public/js/features/lan/transport-host-election.mjs',
  'public/js/features/lan/transport-init.mjs',
  'public/js/features/lan/transport.mjs',
  'public/js/features/pase-board-runtime.mjs',
  'public/js/features/pase-board-cache-keys.mjs',
  'public/js/features/pase-board-inner-cache.mjs',
  'public/js/features/pase-board-render.mjs',
  'public/js/features/pase-board-navigation.mjs',
  'public/js/features/pase-board.mjs',
]) {
  const n = read(f).split('\n').length;
  console.log(n, f);
}
