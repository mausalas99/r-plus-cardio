/**
 * Contract tests: LAN ward-ready features are wired (called), not only defined.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFeatureSrc } from '../../scripts/lib/read-feature-src.mjs';

const jsRoot = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(jsRoot, rel), 'utf8');

function readLanSources(relPaths) {
  return relPaths.map((rel) => read(rel)).join('\n');
}

function readHistoriaClinicaPanelSources() {
  return readLanSources([
    'features/historia-clinica-panel.mjs',
    'features/historia-clinica-panel/runtime.mjs',
    'features/historia-clinica-panel/state.mjs',
    'features/historia-clinica-panel/catalogs.mjs',
    'features/historia-clinica-panel/data-normalize.mjs',
    'features/historia-clinica-panel/fetch.mjs',
    'features/historia-clinica-panel/labs.mjs',
    'features/historia-clinica-panel/render-html.mjs',
    'features/historia-clinica-panel/mount-widgets.mjs',
    'features/historia-clinica-panel/wire.mjs',
    'features/historia-clinica-panel/save.mjs',
    'features/historia-clinica-panel/panel-controller.mjs',
    'features/historia-clinica-panel/drive-import.mjs',
    'features/historia-clinica-panel/panel-entry.mjs',
  ]);
}

const lanSyncFeature = readLanSources([
  'features/lan/orchestrator.mjs',
  'features/lan/orchestrator-wire.mjs',
  'features/lan/orchestrator-wire-config.mjs',
  'features/lan/orchestrator-wire-events.mjs',
  'features/lan/orchestrator-bundle-apply.mjs',
  'features/lan/orchestrator-commands.mjs',
  'features/lan/orchestrator-boot.mjs',
  'features/lan/orchestrator-runtime.mjs',
]);
const lanEntityVersions = read('features/lan/entity-versions.mjs');
const lanConflicts = read('features/lan/conflicts.mjs');
const lanSyncPush = readLanSources([
  'features/lan/push.mjs',
  'features/lan/push-bridge.mjs',
  'features/lan/push-reconcile.mjs',
  'features/lan/push-revision.mjs',
  'features/lan/push-bundle.mjs',
  'features/lan/push-outbox.mjs',
  'features/lan/push-outbox-drain.mjs',
]);
const lanSyncRoom = readLanSources([
  'features/lan/room.mjs',
  'features/lan/room-bridge.mjs',
  'features/lan/room-wire.mjs',
  'features/lan/room-snapshot.mjs',
  'features/lan/room-host-failover.mjs',
  'features/lan/room-membership.mjs',
  'features/lan/room-post-join.mjs',
]);
const lanSyncPanel =
  read('features/lan/panel.mjs') +
  '\n' +
  read('features/lan/panel-render-once.mjs') +
  '\n' +
  read('features/lan/panel-connection-chrome.mjs') +
  '\n' +
  read('features/lan/panel-delegation.mjs');
const lanPanelDiagnostics = read('features/lan/panel-diagnostics.mjs');
const lanSyncPanelDiagnostics = lanSyncPanel + '\n' + lanPanelDiagnostics;
function readClinicalTeamsSources() {
  const dir = join(jsRoot, 'features/clinical-teams');
  return readFeatureSrc(dir, [
    'index.mjs',
    'teams-roster.mjs',
    'teams-roster-shell.mjs',
    'teams-roster-manage.mjs',
    'teams-roster-team-cards.mjs',
    'teams-roster-submit.mjs',
    'teams-roster-panel.mjs',
    'teams-roster-panel-build.mjs',
    'teams-guardia-bridge.mjs',
    'teams-invite.mjs',
  ]);
}
const clinicalTeams = readClinicalTeamsSources();
const appJs = read('app.js');

describe('LAN module boot wiring', () => {
  it('app.js imports lan-sync windowHandlers', () => {
    assert.match(appJs, /from\s+['"]\.\/features\/lan-sync\.mjs['"]/);
    assert.match(appJs, /lanWindowHandlers|windowHandlers as lanWindowHandlers/);
  });

  it('transport deps use globalThis bridge (esbuild duplicate chunk guard)', () => {
    const bridgeGlobals = read('features/lan/lan-sync-bridge-globals.mjs');
    const transportDeps = read('features/lan/transport-deps.mjs');
    const transportInit = read('features/lan/transport-init.mjs');
    assert.match(bridgeGlobals, /__LAN_SYNC_TRANSPORT_DEPS__/);
    assert.match(transportDeps, /lanSyncTransportDepsGlobal/);
    assert.match(transportDeps, /setLanSyncTransportDepsGlobal/);
    assert.match(transportDeps, /ensureLanSyncTransportDepsWired/);
    assert.match(transportInit, /ensureLanSyncTransportDepsWired\(\)\.then/);
  });

  it('lan-sync wires push bridge before transport and document init', () => {
    const wireFnIdx = lanSyncFeature.indexOf('function wireLanSyncBridges');
    const pushIdx = lanSyncFeature.indexOf('registerLanSyncPushBridge({');
    const transportIdx = lanSyncFeature.indexOf('registerLanSyncTransportDeps({');
    const roomIdx = lanSyncFeature.indexOf('registerLanSyncRoomBridge({');
    const wireHandlersIdx = lanSyncFeature.indexOf('registerLanSyncRoomWireHandlers();');
    const initIdx = lanSyncFeature.indexOf('initLanClientFromStorage();');
    assert.ok(wireFnIdx >= 0 && pushIdx >= 0 && transportIdx >= 0 && roomIdx >= 0);
    assert.ok(wireHandlersIdx >= 0 && initIdx >= 0);
    assert.ok(pushIdx < transportIdx, 'push bridge before transport deps');
    assert.ok(pushIdx < initIdx, 'push bridge before init');
    assert.ok(roomIdx < initIdx, 'room bridge before init');
    assert.ok(wireHandlersIdx < initIdx, 'room wire handlers before init');
  });

  it('applyLiveSyncDeltas handles lab_upsert delta log entries (P2b)', () => {
    assert.match(lanSyncFeature, /entry\.type === 'lab_upsert'/);
    assert.match(lanSyncFeature, /applyLabUpsertDelta/);
    assert.match(lanSyncFeature, /mergeLabHistorySets/);
    assert.match(lanSyncPush, /applyLiveSyncDeltas/);
  });

  it('applyLiveSyncDeltas handles lab_delete delta log entries', () => {
    assert.match(lanSyncFeature, /entry\.type === 'lab_delete'/);
    assert.match(lanSyncFeature, /applyLabDeleteDelta/);
  });

  it('push bridge includes fetchAndApplyClinicalOpsFromHost for reconcile', () => {
    const block = lanSyncFeature.slice(
      lanSyncFeature.indexOf('registerLanSyncPushBridge({'),
      lanSyncFeature.indexOf('registerLanSyncRoomBridge({')
    );
    assert.match(block, /fetchAndApplyClinicalOpsFromHost/);
    assert.match(lanSyncPush, /ensureLanSyncPushBridgeWired/);
    assert.match(
      lanSyncPush,
      /await b\.applyLiveSyncMerged\(merged\)[\s\S]*b\.fetchAndApplyClinicalOpsFromHost\(rid/
    );
    assert.match(lanSyncPush, /reapplyLanPatientEntries/);
    assert.match(lanSyncRoom, /ensureLanSyncRoomBridgeWired/);
    assert.match(lanSyncRoom, /buildLiveSyncBundleEnvelope[\s\S]*ensureLanSyncRoomBridgeWired/);
  });

  it('livesync:hello handler sends revision hint, NOT a full WS bundle', () => {
    // Verify the hello handler calls emitLiveSyncRevisionHint
    assert.match(
      lanSyncRoom,
      /livesync:hello[\s\S]{0,300}emitLiveSyncRevisionHint/,
      'hello handler must call emitLiveSyncRevisionHint'
    );
    // Verify it does NOT call buildLiveSyncBundleEnvelope inside the hello block
    const helloBlock = lanSyncRoom.slice(
      lanSyncRoom.indexOf("data.type === 'livesync:hello' && data.clientId !== myId"),
      lanSyncRoom.indexOf("data.type === 'livesync:hello' && data.clientId !== myId") + 400
    );
    assert.doesNotMatch(
      helloBlock,
      /buildLiveSyncBundleEnvelope/,
      'hello handler must not call buildLiveSyncBundleEnvelope'
    );
  });

  it('panel runtime registers conflict drafts append', () => {
    assert.match(lanSyncFeature, /registerLanSyncPanelRuntime/);
    assert.match(lanSyncFeature, /appendLanConflictDraftsSection/);
    assert.match(lanSyncPanel, /appendConflictDrafts\(root\)/);
    assert.match(lanSyncPanel, /runtime\(\)\.appendLanConflictDraftsSection/);
  });
});

describe('LAN event and handler wiring', () => {
  it('revision WS message schedules reconcile', () => {
    assert.match(
      lanSyncRoom,
      /livesync:revision[\s\S]*scheduleReconcileFromRevisionHint/
    );
  });

  it('live connected flushes outbox', () => {
    assert.match(
      lanSyncRoom,
      /lan-live-status[\s\S]*flushLiveSyncOutbox\(activeLiveSyncRoomId\)/
    );
  });

  it('diagnostics retry button flushes outbox', () => {
    assert.match(lanSyncPanelDiagnostics, /Reintentar cola de sincronización/);
    assert.match(lanSyncPanelDiagnostics, /flushLiveSyncOutbox\(rid\)/);
  });

  it('clinical-ops sync events wired at boot and on panel delegate', () => {
    assert.match(lanSyncFeature, /wireClinicalOpsLanSyncEvents\(\)/);
    assert.match(lanSyncPanel, /wireClinicalOpsLanSyncEvents/);
    assert.match(
      lanSyncPanel,
      /rpc-clinical-teams-changed[\s\S]*pushClinicalOpsLanNow/
    );
  });

  it('lan-sync-panel imports syncLiveSyncStatusChrome and resolveLanHostUrlAuto', () => {
    assert.match(
      lanSyncPanel,
      /import\s*\{[\s\S]*?syncLiveSyncStatusChrome[\s\S]*?\}\s*from '\.\/room\.mjs'/
    );
    assert.match(
      read('features/lan/panel-render-once.mjs'),
      /resolveLanHostUrlAuto/
    );
  });

  it('lan panel full render runs on first open while dropdown is open', () => {
    assert.match(lanSyncPanel, /lanPanelHasBuiltChrome/);
    assert.match(lanSyncPanel, /lanPanelNeedsFullRebuild/);
    assert.match(lanSyncPanel, /!force &&/);
    assert.match(
      lanSyncPanel,
      /isLanConnectionDropdownOpen\(\)[\s\S]*?deps\.lanPanelHasBuiltChrome\(root\)[\s\S]*?!deps\.lanPanelNeedsFullRebuild\(root\)/
    );
    assert.match(lanSyncPanel, /showInvitePaste: needsInvitePaste/);
  });

  it('clinical ops merge runs before patient scope filter and emits rpc-clinical-ops-synced', () => {
    const fnStart = lanSyncFeature.indexOf('async function applyLiveSyncMerged');
    assert.ok(fnStart >= 0);
    const patientSyncIdx = lanSyncFeature.indexOf('applyLanPatientEntries(entries', fnStart);
    const opsIdx = lanSyncFeature.indexOf('await applyClinicalOpsLanSnapshot(merged.clinicalOps)', fnStart);
    assert.ok(opsIdx >= 0 && patientSyncIdx >= 0);
    assert.ok(opsIdx < patientSyncIdx, 'clinical ops before LAN patient apply');
    assert.match(read('clinical-ops-lan.mjs'), /rpc-clinical-ops-synced/);
  });

  it('stampTodosWithEntityVersions uses liveSyncEntityStoreKey not bare todoEntityKey', () => {
    const fnStart = lanEntityVersions.indexOf('function stampTodosWithEntityVersions');
    assert.ok(fnStart >= 0);
    const fnEnd = lanEntityVersions.indexOf('function rememberTodosFromMap', fnStart);
    const body = lanEntityVersions.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 400);
    assert.match(body, /liveSyncEntityStoreKey\('todo'/);
    assert.doesNotMatch(body, /todoEntityKey\(/);
  });

  it('legacy conflict drafts section offers discard all', () => {
    assert.match(lanConflicts, /clearAllDraftConflicts/);
    assert.match(lanConflicts, /Conflictos antiguos[\s\S]*Descartar todos/);
  });

  it('saveState after hook does NOT call scheduleLiveSyncPush', () => {
    const hookStart = lanSyncFeature.indexOf('setSaveStateHooks({');
    assert.ok(hookStart >= 0, 'setSaveStateHooks call must exist');
    const hookBlock = lanSyncFeature.slice(hookStart, hookStart + 300);
    assert.doesNotMatch(
      hookBlock,
      /scheduleLiveSyncPush\(\)/,
      'saveState after() must not call scheduleLiveSyncPush()'
    );
  });

  it('onMedicionRegistered schedules LAN bundle push for mobile EA vitals', () => {
    const appRuntimes = read('app-runtimes.mjs');
    const hookStart = appRuntimes.indexOf('onMedicionRegistered: function ()');
    assert.ok(hookStart >= 0, 'onMedicionRegistered hook must exist');
    const hookBlock = appRuntimes.slice(hookStart, hookStart + 220);
    assert.match(
      hookBlock,
      /scheduleLiveSyncPush\(\)/,
      'vitals registration must debounce-push monitoreo to LAN host'
    );
  });

  it('estadoActualGuardar schedules LAN bundle push after saveState', () => {
    const eaActions = read('features/estado-actual-panel-actions.mjs');
    const fnStart = eaActions.indexOf('function persistEstadoActualTexto(');
    assert.ok(fnStart >= 0, 'persistEstadoActualTexto must exist');
    const fnBlock = eaActions.slice(fnStart, fnStart + 350);
    assert.match(fnBlock, /saveState\(\)/);
    assert.match(
      fnBlock,
      /scheduleLiveSyncPush\(\)/,
      'Guardar must debounce-push monitoreo to LAN host'
    );
  });

  it('LAN patient entry apply refreshes Estado Actual for active patient', () => {
    const patientEntries = read('features/lan/patient-entries.mjs');
    assert.match(
      patientEntries,
      /renderEstadoActualPanel\(\{ force: true, syncHeavy: true \}\)/,
      'host reconcile must repaint EA when monitoreo merges'
    );
  });

  it('mobile LAN prune does not wipe census before scope is ready', () => {
    const mobileLan = read('clinical-access-runtime/mobile.mjs');
    assert.doesNotMatch(
      mobileLan,
      /isClinicalScopeReadyForLanPatientApply\(\)[\s\S]{0,180}setPatients\(\[\]\)/,
      'must not clear census while clinical scope is still loading'
    );
  });

  it('history-clinica-panel does not call scheduleLiveSyncPush after lanPushHistoriaClinica', () => {
    const hcPanel = readHistoriaClinicaPanelSources();
    assert.doesNotMatch(
      hcPanel,
      /scheduleLiveSyncPush\(\)/,
      'historia-clinica-panel must not call scheduleLiveSyncPush'
    );
  });

  it('scheduleReconcileFromRevisionHint references tryDeltaReplayFromHint', () => {
    assert.match(
      lanSyncPush,
      /tryDeltaReplayFromHint|\/deltas\?afterSeq/,
      'push.mjs must reference delta replay in the revision-hint reconcile path'
    );
  });

  it('panel.mjs references reconnectFromOfflineUi or similar offline reconnect handler', () => {
    assert.match(
      lanSyncPanel,
      /reconnectFromOffline|userInitiatedReconnect|Sin conexi/,
      'panel.mjs must reference the offline reconnect flow'
    );
  });

  it('panel.mjs references lanNetworkProfile', () => {
    assert.match(lanSyncPanel, /lanNetworkProfile/);
  });
});

describe('clinical teams LAN publish wiring', () => {
  const publishPaths = [
    'handleLeaveTeamClick',
    'handleDeleteTeamClick',
    'handleAddMemberSubmit',
    'joinTeamById',
    'handleCreateTeamSubmit',
  ];

  it('handleEditTeamSubmit delegates to submitTeamEdit which publishes to LAN', () => {
    assert.match(clinicalTeams, /async function handleEditTeamSubmit[\s\S]*submitTeamEdit/);
    assert.match(
      clinicalTeams,
      /submitTeamEdit[\s\S]*rpc-clinical-teams-changed[\s\S]*publishClinicalTeamsToLan/
    );
  });

  for (const fn of publishPaths) {
    it(`${fn} publishes or dispatches teams-changed for LAN`, () => {
      const start = clinicalTeams.indexOf(`async function ${fn}`);
      const alt = clinicalTeams.indexOf(`function ${fn}`);
      const idx = start >= 0 ? start : alt;
      assert.ok(idx >= 0, `missing ${fn}`);
      const end = clinicalTeams.indexOf('\nasync function ', idx + 1);
      const body = clinicalTeams.slice(idx, end > idx ? end : idx + 2500);
      const hasPublish =
        body.includes('publishClinicalTeamsToLan') ||
        body.includes("dispatchEvent(new CustomEvent('rpc-clinical-teams-changed')");
      assert.ok(hasPublish, `${fn} must publishClinicalTeamsToLan or dispatch teams-changed`);
    });
  }

  it('handleMyCycleSubmit publishes membership to LAN', () => {
    const idx = clinicalTeams.indexOf('async function handleMyCycleSubmit');
    assert.ok(idx >= 0);
    const end = clinicalTeams.indexOf('\nasync function resolveTeamIdForInviteInput', idx);
    const body = clinicalTeams.slice(idx, end);
    assert.match(body, /publishClinicalTeamsToLan/);
    assert.match(body, /rpc-clinical-teams-changed/);
  });

  it('leave team button delegates to handleLeaveTeamClick', () => {
    assert.match(clinicalTeams, /clinical-teams-leave-btn/);
    assert.match(
      clinicalTeams,
      /closest\('\.clinical-teams-leave-btn'\)[\s\S]*handleLeaveTeamClick/
    );
    assert.match(clinicalTeams, /wireTeamManageModalDelegation/);
  });

  it('Mi rotación pulls host ops on open', () => {
    assert.match(
      clinicalTeams,
      /renderClinicalTeamsPanelInto[\s\S]*pullClinicalOpsFromLanRoom/
    );
  });
});
