/** LAN orchestrator runtime shell and boot helpers (IM-11). */
import { storage } from '../../storage.js';
import { mergeLiveSyncFullBundles } from '../../lan-merge-registry.mjs';
import { perfMark, perfMeasure } from '../../perf-markers.mjs';
import {
  canLocalMacBeLanHost,
  isClinicalRankConfiguredForLan,
} from '../../lan-host-rank-policy.mjs';
import { isLanElectronDesktop, initLanHostPlugAndPlay } from './transport.mjs';
import { getSurrogateHostState } from '../../lan-surrogate-host.mjs';
import { getActiveLiveSyncRoomId } from './room.mjs';

function renderPatientListLanSilent() {
  runtime.renderPatientList({ silent: true });
}

let runtime = {
  showToast() {},
  renderPatientList(_opts) {},
  renderNoteForm() {},
  renderLabHistoryPanel() {},
  renderEstadoActualPanel() {},
  getActiveId() {
    return null;
  },
  setActiveId() {},
  getActiveAppTab() {
    return "lab";
  },
  selectPatient() {},
  isMobileWeb() {
    return false;
  },
  renderProcedureAgendaPanel() {},
  refreshAllTodoUIs() {},
  refreshTodoUIsForPatient() {},
  refreshTodoUIsForPatients() {},
  syncWorkContextChrome() {},
  findPatientByRegistro() {
    return null;
  },
  ensureUniquePatientName(x) {
    return x;
  },
  applyImportEntry() {
    return "";
  },
  syncSettingsLanHostDiskSection() {},
  buildPatientEntry() {
    return null;
  },
  closeSettingsDropdown() {},
};

/** Dev-only: profiled bundle merge (Phase 0 LAN sync gate). */
export function profiledMergeLiveSyncFullBundles(sources) {
  perfMark('lan-sync-merge-start');
  var merged = mergeLiveSyncFullBundles(sources);
  perfMark('lan-sync-merge-end');
  perfMeasure('lan-sync-merge', 'lan-sync-merge-start', 'lan-sync-merge-end');
  return merged;
}

export function profiledRefreshTodoUIsAfterReconcile(touchedTodoPatientIds) {
  perfMark('lan-sync-todos-refresh-start');
  try {
    if (typeof runtime.refreshTodoUIsForPatients === 'function') {
      runtime.refreshTodoUIsForPatients(touchedTodoPatientIds);
    } else if (typeof runtime.refreshTodoUIsForPatient === 'function') {
      touchedTodoPatientIds.forEach(function (pid) {
        runtime.refreshTodoUIsForPatient(pid);
      });
    } else {
      runtime.refreshAllTodoUIs();
    }
  } finally {
    perfMark('lan-sync-todos-refresh-end');
    perfMeasure('lan-sync-todos-refresh', 'lan-sync-todos-refresh-start', 'lan-sync-todos-refresh-end');
  }
}

let _lanNetworkRefreshWired = false;

function wireLanNetworkRefresh() {
  if (_lanNetworkRefreshWired || typeof window === 'undefined') return;
  _lanNetworkRefreshWired = true;
  window.addEventListener('online', function () {
    void (async function () {
      /** @type {{ prefixes?: string[], candidateBaseUrl?: string }} */
      var payload = {};
      if (window.electronAPI?.getLanSubnetPrefixes && window.electronAPI?.getLanCandidateBaseUrl) {
        try {
          var prefixes = await window.electronAPI.getLanSubnetPrefixes();
          var candidateBaseUrl = await window.electronAPI.getLanCandidateBaseUrl();
          payload = { prefixes: prefixes || [], candidateBaseUrl: candidateBaseUrl || '' };
        } catch (_e) { void _e; }
      }
      var m = await import('../../lan-network-change.mjs');
      if (typeof m.handleLanNetworkChanged === 'function') {
        await m.handleLanNetworkChanged(payload);
      }
    })();
  });
  if (window.electronAPI && typeof window.electronAPI.onLanNetworkChanged === 'function') {
    window.electronAPI.onLanNetworkChanged(function (payload) {
      void import('../../lan-network-change.mjs').then(function (m) {
        if (typeof m.handleLanNetworkChanged === 'function') {
          return m.handleLanNetworkChanged(payload || {});
        }
      });
    });
  }
}

export function registerLanRuntime(ctx) {
  if (!ctx || typeof ctx !== "object") return;
  Object.assign(runtime, ctx);
  wireLanNetworkRefresh();
  void (async function () {
    const { isClinicalLocalOnlyMode, readRpcSettings } = await import('../../clinical-settings.mjs');
    if (isClinicalLocalOnlyMode(readRpcSettings())) return;
    const { seedBundledWardConnectionPoints } = await import('../../lan-ward-host-registry.mjs');
    seedBundledWardConnectionPoints();
    const pin = await import('../../lan-shift-pin-connect.mjs');
    if (typeof pin.tryEasyLanShiftPinConnect === 'function') {
      await pin.tryEasyLanShiftPinConnect({ silent: true, skipCooldown: true });
    }
    await initLanHostPlugAndPlay();
  })();
}

export function getLanRuntime() {
  return runtime;
}

export { renderPatientListLanSilent };

export function scheduleTierALanServerWarm() {
  if (!isLanElectronDesktop()) return;
  if (typeof window === 'undefined' || !window.electronAPI?.ensureLanServerReady) return;
  if (!isClinicalRankConfiguredForLan()) return;
  var uiRole = typeof storage.getLanUiRole === 'function' ? storage.getLanUiRole() : '';
  if (uiRole === 'host' && canLocalMacBeLanHost()) {
    void window.electronAPI.ensureLanServerReady();
    return;
  }
  if (uiRole === 'client') {
    if (typeof storage.getLanConfig === 'function' && storage.getLanConfig()) {
      void window.electronAPI.ensureLanServerReady();
      return;
    }
  }
  if (getSurrogateHostState()) {
    void window.electronAPI.ensureLanServerReady();
    return;
  }
  if (getActiveLiveSyncRoomId()) {
    void window.electronAPI.ensureLanServerReady();
  }
}

