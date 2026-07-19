import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const jsDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const lanDir = join(jsDir, 'features/lan');
const clinicalTeamsDir = join(dirname(fileURLToPath(import.meta.url)), 'clinical-teams');

function readConcat(dir, names) {
  return names.map((name) => readFileSync(join(dir, name), 'utf8')).join('\n');
}

const lanSyncSrc = readConcat(lanDir, [
  'orchestrator.mjs',
  'orchestrator-runtime.mjs',
  'orchestrator-boot.mjs',
  'orchestrator-wire.mjs',
  'orchestrator-wire-config.mjs',
  'orchestrator-wire-events.mjs',
  'orchestrator-interno.mjs',
  'orchestrator-bundle-apply.mjs',
  'orchestrator-collect.mjs',
  'orchestrator-commands.mjs',
]);
const lanConflictsSrc = readFileSync(join(lanDir, 'conflicts.mjs'), 'utf8');
const lanHostPatientHttpSrc = readFileSync(join(lanDir, 'host-patient-http.mjs'), 'utf8');
const lanSyncRoomSrc = readConcat(lanDir, [
  'room.mjs',
  'room-bridge.mjs',
  'room-snapshot.mjs',
  'room-host-failover.mjs',
  'room-phase-chrome.mjs',
  'room-clinical-ops.mjs',
  'room-wire.mjs',
  'room-membership.mjs',
  'room-post-join.mjs',
]);
const lanSyncTransportSrc = readConcat(lanDir, [
  'transport.mjs',
  'transport-deps.mjs',
  'transport-session.mjs',
  'transport-host-url.mjs',
  'transport-pairing.mjs',
  'transport-mobile.mjs',
  'transport-host-election.mjs',
  'transport-init.mjs',
]);
const lanSyncPanelSrc = readConcat(lanDir, [
  'panel.mjs',
  'panel-invite-join.mjs',
  'panel-delegation.mjs',
  'panel-host-pin.mjs',
  'panel-hub-status.mjs',
]);
const lanSyncPushSrc = readConcat(lanDir, [
  'push.mjs',
  'push-bridge.mjs',
  'push-helpers.mjs',
  'push-bundle.mjs',
  'push-outbox.mjs',
  'push-outbox-drain.mjs',
  'push-revision.mjs',
  'push-schedule.mjs',
  'push-conflict.mjs',
  'push-conflict-ops.mjs',
  'push-conflict-put.mjs',
  'push-clinical-ops.mjs',
  'push-reconcile.mjs',
]);
const lanSyncFeatureSrc =
  lanSyncSrc + '\n' + lanSyncRoomSrc + '\n' + lanSyncTransportSrc + '\n' + lanSyncPanelSrc;
const lanSyncPushAndFeatureSrc = lanSyncFeatureSrc + '\n' + lanSyncPushSrc;
const clinicalOpsLanSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../clinical-ops-lan.mjs'),
  'utf8'
);
const clinicalTeamsLanSrc = readConcat(clinicalTeamsDir, [
  'teams-roster-lan.mjs',
  'teams-roster-lan-dom.mjs',
  'teams-roster-lan-render.mjs',
  'teams-roster-lan-row-html.mjs',
  'teams-roster-lan-filters.mjs',
  'teams-roster-lan-state.mjs',
  'teams-roster-lan-load.mjs',
  'teams-roster-lan-modal.mjs',
  'teams-roster-lan-assign.mjs',
  'teams-roster-lan-wire.mjs',
]);
const clinicalTeamsSrc =
  readFileSync(join(clinicalTeamsDir, 'index.mjs'), 'utf8') +
  '\n' +
  readConcat(clinicalTeamsDir, [
    'teams-roster-render.mjs',
    'teams-roster-create.mjs',
    'teams-roster-team-cards.mjs',
    'teams-roster-directory.mjs',
    'teams-roster-panel.mjs',
    'teams-roster-panel-build.mjs',
  ]) +
  '\n' +
  readFileSync(join(clinicalTeamsDir, 'teams-roster.mjs'), 'utf8');

describe('lan-sync clinical ops', () => {
  it('exports prepareClinicalOpsForLanSync helper', () => {
    assert.match(clinicalOpsLanSrc, /export async function prepareClinicalOpsForLanSync/);
  });

  it('refreshes clinical ops before building LiveSync bundles', () => {
    assert.match(lanSyncRoomSrc, /async function buildLiveSyncBundleEnvelope/);
    assert.match(lanSyncRoomSrc, /await prepareClinicalOpsForLanSync\(\)/);
  });

  it('includes local clinicalOps when merging peer bundles', () => {
    assert.match(lanSyncFeatureSrc, /function buildLiveSyncLocalMergeSource/);
    assert.match(lanSyncFeatureSrc, /buildLiveSyncLocalMergeSource\(\)/);
  });

  it('pushes clinical ops after joining a room', () => {
    assert.match(lanSyncRoomSrc, /syncLiveSyncAfterRoomJoin[\s\S]*scheduleLiveSyncPush\(\)/);
    assert.match(
      lanSyncRoomSrc,
      /syncLiveSyncAfterRoomJoinBody[\s\S]*pushClinicalOpsLanNow[\s\S]*reconcileLiveSyncRoom/
    );
  });

  it('re-publishes merged roster after pulling host clinical ops', () => {
    assert.match(lanSyncRoomSrc, /scheduleClinicalOpsGossipPush/);
    assert.match(lanSyncRoomSrc, /fetchAndApplyClinicalOpsFromHost[\s\S]*scheduleClinicalOpsGossipPush/);
  });

  it('shows toast when clinical ops merge fails', () => {
    assert.match(lanSyncSrc, /No se pudieron sincronizar equipos ni usuarios LAN/);
  });

  it('exports immediate clinical ops push after @usuario registration', () => {
    assert.match(lanSyncPushSrc, /export async function pushClinicalOpsLanNow/);
    assert.match(lanSyncSrc, /pushClinicalOpsLanNow/);
  });

  it('records push trace for each clinical ops skip code', () => {
    for (const code of ['NO_CLINICAL_OPS', 'NO_SNAPSHOT', 'NO_LAN', 'NO_ROOM']) {
      assert.match(
        lanSyncPushSrc,
        new RegExp(`recordClinicalOpsTrace\\('push', \\{[\\s\\S]*code: '${code}'`)
      );
    }
  });

  it('always attaches fresh clinicalOps on immediate profile push', () => {
    assert.match(lanSyncPushSrc, /envelope\.clinicalOps = snap/);
    assert.doesNotMatch(
      lanSyncPushSrc,
      /if \(!liveSyncBundleHasPayload\(envelope\)\) \{\s*envelope\.clinicalOps = snap/
    );
  });

  it('directory refresh uses sticky room membership when active room is empty', () => {
    assert.match(lanSyncPushSrc, /export function ensureEffectiveLiveSyncRoomId/);
    assert.match(lanSyncRoomSrc, /refreshLanClinicalDirectoryFromRoom[\s\S]*ensureEffectiveLiveSyncRoomId/);
  });

  it('directory refresh can pull clinical ops from all sala rooms', () => {
    assert.match(lanSyncRoomSrc, /lanClinicalDirectoryPullRoomIds/);
    assert.match(lanSyncRoomSrc, /allRooms[\s\S]*fetchAndApplyClinicalOpsFromHost/);
    assert.match(
      clinicalTeamsLanSrc,
      /refreshLanClinicalDirectoryFromRoom[\s\S]*allRooms:\s*true/
    );
  });

  it('mints a fresh LAN ticket when copying sala invite; mobile uses permanent URL', () => {
    assert.match(lanSyncPanelSrc, /ensureLanPairingForShare\(\{ forceNew: true \}\)/);
    assert.match(lanSyncPanelSrc, /copyMobileLanLinkFromUi/);
    assert.match(lanSyncPanelSrc, /buildPermanentMobileJoinUrl/);
    assert.match(lanSyncPanelSrc, /resolvePermanentMobileShareUrl/);
    assert.match(lanSyncPanelSrc, /appendMobileSharerParamsToJoinUrl/);
    assert.match(lanSyncPanelSrc, /lan-pairing-display-mobile/);
    assert.match(lanSyncPanelSrc, /lan-pairing-display-sala/);
    assert.match(lanSyncPanelSrc, /canOfferMobileLanShare/);
    assert.doesNotMatch(lanSyncPanelSrc, /params\.set\('code', teamCode\)/);
    const salaCopyBlock = lanSyncPanelSrc.match(
      /export async function copyLanInviteLinkFromUi[\s\S]{0,900}/
    );
    assert.ok(salaCopyBlock);
    assert.doesNotMatch(salaCopyBlock[0], /appendMobileSharerParamsToJoinUrl/);
  });

  it('offers iPad link to LAN clients connected to the ward host', () => {
    const canOfferBlock = lanSyncPanelSrc.match(
      /function canOfferMobileLanShare\(\) \{[\s\S]{0,320}\}/
    );
    assert.ok(canOfferBlock);
    assert.doesNotMatch(canOfferBlock[0], /isLanRemoteJoinMode\(\)\) return false/);
    assert.match(lanSyncTransportSrc, /if \(isLanRemoteJoinMode\(\)\) \{[\s\S]*remoteCfg\.hostUrl/);
  });

  it('does not reconnect live WS inside pushClinicalOpsLanNow', () => {
    assert.match(lanSyncPushSrc, /export function sendLiveBundleIfOpen/);
    assert.match(lanSyncPushSrc, /pushedLive = sendLiveBundleIfOpen\(roomId, envelope\)/);
    assert.doesNotMatch(
      lanSyncPushAndFeatureSrc,
      /if \(lanClient\.liveConnected\)[\s\S]{0,120}connectLiveChannel\(roomId\)/
    );
  });

  it('returns structured channels from pushClinicalOpsLanNow', () => {
    assert.match(lanSyncPushSrc, /export function lanPushResult/);
    assert.match(
      lanSyncPushSrc,
      /lanPushResult\(true, undefined, \{ http: !!okHttp, live: pushedLive \}\)/
    );
    assert.match(lanSyncPushSrc, /\/clinical-ops/);
  });

  it('uses HTTP-primary debounced push without WS bundle', () => {
    assert.match(lanSyncPushSrc, /HTTP sync-bundle is authoritative/);
    assert.doesNotMatch(
      lanSyncPushSrc,
      /scheduleLiveSyncPush[\s\S]{0,400}lanClient\.sendLive\(bundle\)/
    );
  });

  it('debounced push uses sticky room membership like profile push', () => {
    assert.match(
      lanSyncPushSrc,
      /export function scheduleLiveSyncPush\(\) \{[\s\S]*ensureEffectiveLiveSyncRoomId\(\)/
    );
    assert.doesNotMatch(
      lanSyncPushSrc,
      /export function scheduleLiveSyncPush\(\) \{\s*if \(!activeLiveSyncRoomId\) return;/
    );
  });

  it('revision hints reconcile when room matches membership without active room', () => {
    assert.match(lanSyncPushSrc, /liveSyncRoomIdIsRelevant/);
    assert.match(
      lanSyncPushSrc,
      /scheduleReconcileFromRevisionHint[\s\S]*liveSyncRoomIdIsRelevant/
    );
  });

  it('team changes trigger immediate clinical-ops push not only debounced bundle', () => {
    assert.match(
      lanSyncPanelSrc,
      /rpc-clinical-teams-changed[\s\S]*pushClinicalOpsLanNow/
    );
  });

  it('entrega assign pushes clinical ops so interno board receives pendientes', () => {
    const entregaSrc =
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'clinical-entrega.mjs'), 'utf8') +
      '\n' +
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'clinical-entrega/clinical-entrega-submit.mjs'),
        'utf8'
      );
    assert.match(entregaSrc, /submitEntregaAssignment[\s\S]*pushClinicalOpsLanNow/);
    assert.match(lanSyncSrc, /registerMutationHandler\('entrega'[\s\S]*pushClinicalOpsLanNow/);
  });

  it('Mi rotación pulls clinical ops from host before listing teams', () => {
    assert.match(clinicalTeamsSrc, /renderClinicalTeamsPanelInto[\s\S]*pullClinicalOpsFromLanRoom/);
  });

  it('handles livesync revision hints from peers', () => {
    assert.match(lanSyncPushAndFeatureSrc, /livesync:revision/);
    assert.match(lanSyncPushAndFeatureSrc, /scheduleReconcileFromRevisionHint/);
  });

  it('shows conflict drafts in LAN panel after host pin section', () => {
    assert.match(lanSyncPanelSrc, /appendLanConflictDraftsSection/);
    assert.match(lanSyncFeatureSrc, /registerLanSyncPanelRuntime[\s\S]*appendLanConflictDraftsSection/);
  });

  it('waits for live WS before reconcile on boot and join', () => {
    assert.match(lanSyncRoomSrc, /waitForLiveChannelOpen/);
    assert.match(lanSyncRoomSrc, /bootLanRoomMembership[\s\S]*waitForLiveChannelOpen[\s\S]*syncLiveSyncAfterRoomJoin/);
    assert.match(lanSyncRoomSrc, /joinLanRoom[\s\S]*waitForLiveChannelOpen[\s\S]*syncLiveSyncAfterRoomJoin/);
  });

  it('auto-joins sala from settings on boot when membership is absent', () => {
    assert.match(
      lanSyncTransportSrc,
      /initLanClientFromStorage[\s\S]*resolveAutoJoinRoomId[\s\S]*joinLanRoom/
    );
  });

  it('reconnect loop resyncs once per session when live WS already open', () => {
    assert.match(lanSyncRoomSrc, /_liveSyncSessionResyncDone/);
    assert.match(
      lanSyncRoomSrc,
      /liveConnected[\s\S]*_liveSyncSessionResyncDone[\s\S]*syncLiveSyncAfterRoomJoin/
    );
  });

  it('records sync-bundle failures in diagnostics lastErrors', () => {
    assert.match(lanSyncPushSrc, /recordLanSyncError[\s\S]*sync-bundle/);
  });

  it('applies bundle LWW on legacy 409 with server bundle', () => {
    assert.match(lanSyncPushSrc, /resp\.status === 409/);
    assert.match(lanSyncPushSrc, /applyServerBundleLwwLocally/);
    assert.match(lanSyncPushSrc, /notifyBundleLwwOverwrite/);
    assert.doesNotMatch(
      lanSyncPushSrc,
      /saveDraftConflict\([\s\S]{0,200}entityType:\s*'roomBundle'/
    );
  });

  it('pauses debounced bundle push while cooldown active', () => {
    assert.match(lanSyncPushSrc, /isBundlePushPaused\(roomId\)/);
  });

  it('does not re-enqueue bundle after handled 409', () => {
    assert.match(lanSyncPushSrc, /BUNDLE_PUSH_HANDLED/);
    assert.match(
      lanSyncPushSrc,
      /pushResult !== true[\s\S]*pushResult !== BUNDLE_PUSH_HANDLED[\s\S]*enqueueOutbox/
    );
  });

  it('exports clinical directory refresh for Mi rotación directorio', () => {
    assert.match(lanSyncFeatureSrc, /export[\s\S]*refreshLanClinicalDirectoryFromRoom/);
    assert.match(lanSyncFeatureSrc, /fetchAndApplyClinicalOpsFromHost/);
  });

  it('pushClinicalOpsLanNow does not fall back to pushRoomSyncBundleToHost', () => {
    const start = lanSyncPushSrc.indexOf('export async function pushClinicalOpsLanNow');
    assert.ok(start >= 0);
    const end = lanSyncPushSrc.indexOf('export async function reconcileLiveSyncRoom', start);
    const body = lanSyncPushSrc.slice(start, end);
    assert.doesNotMatch(body, /pushRoomSyncBundleToHost/);
  });

  it('flushLiveSyncOutbox drains clinical_ops and aborts on first failure', () => {
    assert.match(lanSyncPushSrc, /pushClinicalOpsPayloadToHost/);
    assert.match(lanSyncPushSrc, /drainOutboxFromIndex/);
    assert.match(lanSyncPushSrc, /reenqueueOutboxSlice\(rid,\s*sorted\.slice\(index\)\)/);
  });

  it('clinical-ops 409 returns CONFLICT_RESOLVED success', () => {
    assert.match(lanSyncPushSrc, /CONFLICT_RESOLVED/);
    assert.match(lanSyncPushSrc, /resolveClinicalOps409/);
    assert.match(lanSyncPushSrc, /lanPushResult\(true,\s*'CONFLICT_RESOLVED'/);
  });

  it('clinical-ops PUT retries once after 409 revision align', () => {
    assert.match(lanSyncPushSrc, /putClinicalOpsSnapshotToHost/);
    assert.match(lanSyncPushSrc, /retryResp/);
    assert.match(lanSyncPushSrc, /clinicalOpsLanPushInFlight/);
  });

  it('handleSyncConflict applies LWW without conflict modal', () => {
    assert.match(lanConflictsSrc, /applyLwwConflictLocally/);
    assert.match(lanConflictsSrc, /notifyLwwOverwrite/);
    assert.doesNotMatch(
      lanConflictsSrc,
      /async function handleSyncConflict[\s\S]{0,800}saveDraftConflict/
    );
    assert.doesNotMatch(
      lanConflictsSrc,
      /async function handleSyncConflict[\s\S]{0,800}openClinicalConflictViewer/
    );
  });

  it('lanPushPatientVersioned toasts on lwwApplied without 409 modal', () => {
    assert.match(
      lanHostPatientHttpSrc,
      /export async function lanPushPatientVersioned[\s\S]{0,1200}notifyLwwOverwrite/
    );
    assert.doesNotMatch(
      lanHostPatientHttpSrc,
      /export async function lanPushPatientVersioned[\s\S]{0,1200}resp\.status === 409/
    );
  });

  it('applyLiveSyncApplied syncs host bases and LWW toast', () => {
    assert.match(lanSyncSrc, /syncHostBundleEntityFromApplied/);
    assert.match(lanSyncSrc, /function applyLiveSyncApplied[\s\S]*notifyLiveSyncAppliedOutcome/);
    assert.match(lanSyncSrc, /notifyLiveSyncAppliedOutcome[\s\S]*notifyLwwOverwrite/);
  });

  it('outbox clinical-ops push handles 409 without re-enqueue loop', () => {
    assert.match(lanSyncPushSrc, /resolveClinicalOps409/);
    assert.match(lanSyncPushSrc, /ensureClinicalOpsPushRevision/);
    assert.match(lanSyncPushSrc, /CLINICAL_OPS_HANDLED/);
  });

  it('clinical-ops enqueue returns QUEUED deferred success', () => {
    assert.match(lanSyncPushSrc, /kind:\s*'clinical_ops'/);
    assert.match(lanSyncPushSrc, /lanPushResult\(true,\s*'QUEUED'/);
  });

  it('reconcile wraps fetchAndApplyClinicalOpsFromHost in try/catch', () => {
    assert.match(lanSyncPushSrc, /fetchAndApplyClinicalOpsFromHost[\s\S]*catch/);
  });

  it('push bridge wires fetchAndApplyClinicalOpsFromHost', () => {
    assert.match(lanSyncFeatureSrc, /registerLanSyncPushBridge\([\s\S]*fetchAndApplyClinicalOpsFromHost/);
  });
});

describe('flushLiveSyncOutboxBody — typed mutation drain', () => {
  it('nota_replace outbox item is drained by calling PUT /patients/:id/nota', () => {
    assert.match(
      lanSyncPushSrc,
      /nota_replace/,
      'push.mjs must handle nota_replace outbox kind'
    );
  });

  it('indicaciones_replace outbox item is handled', () => {
    assert.match(lanSyncPushSrc, /indicaciones_replace/);
  });

  it('lab_history_upsert outbox item is handled', () => {
    assert.match(lanSyncPushSrc, /lab_history_upsert/);
  });

  it('lab_history_delete outbox item is handled', () => {
    assert.match(lanSyncPushSrc, /lab_history_delete/);
  });

  it('patient_fields outbox item is handled', () => {
    assert.match(lanSyncPushSrc, /patient_fields/);
  });
});

describe('clinical-profile-lan-sync', () => {
  const profileLanSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../clinical-profile-lan-sync.mjs'),
    'utf8'
  );

  it('does not block username register when LAN has no room', () => {
    assert.match(profileLanSrc, /assertLanRoomForUsernameRegister/);
    assert.match(profileLanSrc, /allowed: true/);
    assert.doesNotMatch(profileLanSrc, /allowed: false,\s*lanConfigured: true,\s*code: 'NO_ROOM'/);
  });

  it('applies invite URL before username gate', () => {
    assert.match(profileLanSrc, /applyPendingLanInviteFromPage/);
    assert.match(profileLanSrc, /parseLanJoinQuery/);
  });

  it('resolves LiveSync room from clinical Sala when LAN is available (optional)', () => {
    assert.match(profileLanSrc, /ensureLiveSyncRoomForUsernameRegister/);
    assert.match(profileLanSrc, /resolveRoomIdForUsernameRegister/);
    assert.match(profileLanSrc, /isBenignLanPushSkipCode/);
  });

  it('traces push skip before flush returns early (NO_LAN / NO_ROOM)', () => {
    assert.match(profileLanSrc, /traceFlushClinicalProfilePushSkip\('NO_LAN'\)/);
    assert.match(profileLanSrc, /traceFlushClinicalProfilePushSkip\('NO_ROOM'\)/);
    assert.match(profileLanSrc, /recordClinicalOpsTrace\('push'/);
  });

  it('exposes connect-needed message for LAN registration UX', () => {
    assert.match(profileLanSrc, /LAN_PROFILE_NEEDS_CONNECT_MSG/);
    assert.match(profileLanSrc, /isLanProfileNeedsConnectCode/);
  });

  it('shows shift PIN client connect when not ward-live on remote host', () => {
    assert.match(lanSyncTransportSrc, /shouldShowLanShiftPinClientConnect/);
    assert.match(lanSyncTransportSrc, /isLanRestHostOwnMachine/);
    assert.match(lanSyncPanelSrc, /shouldShowLanShiftPinClientConnect/);
    assert.doesNotMatch(
      lanSyncPanelSrc,
      /appendLanShiftPinClientConnectSection[\s\S]*resolveHostBearerToken[\s\S]*if \(lanPanelRenderStale\(gen\) \|\| bearer\) return/
    );
  });

  it('coalesces reconcile to avoid sync-bundle / clinical-ops storms', () => {
    assert.match(lanSyncPushSrc, /reconcileInFlight/);
    assert.match(lanSyncPushSrc, /scheduleReconcileLiveSyncRoom/);
    assert.match(lanSyncPushSrc, /getReconcileCooldownMs/);
    assert.match(lanSyncPushSrc, /bundleHadClinicalOps/);
    assert.match(lanSyncPushSrc, /reconcileLiveSyncRoomBody/);
  });
});
