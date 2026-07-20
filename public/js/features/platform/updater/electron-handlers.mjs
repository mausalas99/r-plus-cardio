/** Individual Electron IPC update event handlers. */
import { formatProgressLine } from '../../../update-helpers.mjs';
import { formatUpdaterReleaseNotesPlain } from '../../settings-help/release-notes.mjs';
import { getPlatformRuntime } from '../runtime.mjs';
import { updaterState } from './state.mjs';
import { syncUpdateModalChannelPill, sendUpdateTelemetry } from './channel-settings.mjs';
import {
  resetUpdateCheckButtons,
  isSnoozeActiveForVersion,
  markDismissedVersion,
  showUpdateModal,
  resetUpdateModalPanels,
  stripHtmlToPlainText,
  renderUpdateError,
  hideUpdateModal,
} from './modal-ui.mjs';
import { installUpdate } from './check-actions.mjs';
import { renderDowngradeFallback } from './downgrade.mjs';

const rt = getPlatformRuntime();

function updateAvailableTitle(isDowngrade, isRepair) {
  if (isDowngrade) return 'Restaurando versión estable';
  if (isRepair) return 'Actualización de reparación';
  return 'Nueva versión';
}

function wireUpdateAvailableActions(version, isDowngrade) {
  var actions = document.getElementById('update-modal-actions-primary');
  if (actions) {
    actions.innerHTML = '';
    if (!isDowngrade) {
      var later = document.createElement('button');
      later.className = 'btn-secondary';
      later.textContent = 'Más tarde';
      later.onclick = function() {
        markDismissedVersion(version);
        hideUpdateModal();
      };
      actions.appendChild(later);
    }
  }
  var sec = document.getElementById('update-modal-actions-secondary');
  if (sec) {
    sec.innerHTML = '';
    if (!isDowngrade) {
      var link = document.createElement('button');
      link.type = 'button';
      link.className = 'btn-link';
      link.textContent = 'Ver notas en GitHub';
      link.onclick = function() {
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal('https://github.com/mausalas99/r-plus-cardio/releases');
        }
      };
      sec.appendChild(link);
    }
  }
}

function populateUpdateAvailableDom(version, releaseNotes, isDowngrade, isRepair) {
  var title = document.getElementById('update-modal-title');
  if (title && title.firstChild && title.firstChild.nodeType === 3) {
    title.firstChild.textContent = updateAvailableTitle(isDowngrade, isRepair);
  }
  var pill = document.getElementById('update-modal-version-pill');
  if (pill) {
    pill.textContent = 'v' + version;
    pill.style.display = 'inline-block';
  }
  syncUpdateModalChannelPill(updaterState.pendingUpdaterIsPrerelease);
  var notes = document.getElementById('update-modal-notes');
  if (notes) notes.textContent = releaseNotes;
  var state = document.getElementById('update-modal-state');
  if (state) state.textContent = 'Conectando… La descarga comenzará en breve.';
  var fill = document.getElementById('update-modal-progress-fill');
  if (fill) fill.style.width = '0%';
  var label = document.getElementById('update-modal-progress-label');
  if (label) label.textContent = '';
}

function handleUpdateAvailable(payload) {
  resetUpdateCheckButtons();
  var version = (payload && payload.version) ? payload.version : String(payload || '');
  var rawNotes = (payload && payload.releaseNotes != null) ? String(payload.releaseNotes) : '';
  var releaseNotes =
    formatUpdaterReleaseNotesPlain(version, rawNotes) || stripHtmlToPlainText(rawNotes);
  updaterState.pendingUpdaterTargetVersion = version;
  updaterState.pendingUpdaterIsPrerelease = !!(payload && payload.prerelease);
  var isDowngrade = updaterState.updateModalMode === 'downgrade';
  var isRepair = updaterState.pendingRepairUpdateCheck;
  if (isRepair) updaterState.pendingRepairUpdateCheck = false;
  if (!isDowngrade && !isRepair && isSnoozeActiveForVersion(version)) return;
  resetUpdateModalPanels();
  populateUpdateAvailableDom(version, releaseNotes, isDowngrade, isRepair);
  wireUpdateAvailableActions(version, isDowngrade);
  showUpdateModal();
}

function handleUpdateProgress(payload) {
  var pct = typeof payload === 'number' ? payload : (payload && payload.percent != null ? payload.percent : 0);
  var transferred = payload && payload.transferred;
  var total = payload && payload.total;
  var bps = payload && payload.bytesPerSecond;
  if (updaterState.pendingUpdaterTargetVersion && updaterState.updateModalMode !== 'downgrade' &&
      isSnoozeActiveForVersion(updaterState.pendingUpdaterTargetVersion)) return;
  resetUpdateModalPanels();
  syncUpdateModalChannelPill(updaterState.pendingUpdaterIsPrerelease);
  var state = document.getElementById('update-modal-state');
  if (state) state.textContent = 'Descargando…';
  var fill = document.getElementById('update-modal-progress-fill');
  if (fill) fill.style.width = pct + '%';
  var label = document.getElementById('update-modal-progress-label');
  if (label) {
    if (transferred != null && total != null) {
      label.textContent = formatProgressLine({
        transferred: transferred,
        total: total,
        bytesPerSecond: bps,
      });
    } else {
      label.textContent = 'Progreso: ' + pct + '%';
    }
  }
  showUpdateModal();
}

function wireUpdateReadyActions(isDowngrade) {
  var actions = document.getElementById('update-modal-actions-primary');
  if (actions) {
    actions.innerHTML = '';
    var go = document.createElement('button');
    go.className = 'btn-primary';
    go.textContent = isDowngrade ? 'Restaurar y reiniciar' : 'Instalar y reiniciar';
    go.onclick = function() {
      updaterState.updateModalMode = 'upgrade';
      updaterState.pendingDowngradeVersion = null;
      installUpdate();
    };
    actions.appendChild(go);
    if (!isDowngrade) {
      var later = document.createElement('button');
      later.className = 'btn-secondary';
      later.textContent = 'Instalar al cerrar';
      later.onclick = function() { hideUpdateModal(); };
      actions.appendChild(later);
    }
  }
  var sec = document.getElementById('update-modal-actions-secondary');
  if (sec) sec.innerHTML = '';
}

function handleUpdateReady(payload) {
  var version = (payload && payload.version) ? payload.version : String(payload || '');
  var isDowngrade = updaterState.updateModalMode === 'downgrade';
  try { sendUpdateTelemetry('success', version); } catch (_e) { void _e; }
  if (!isDowngrade && isSnoozeActiveForVersion(version)) return;
  resetUpdateModalPanels();
  syncUpdateModalChannelPill(updaterState.pendingUpdaterIsPrerelease);
  var state = document.getElementById('update-modal-state');
  if (state) {
    state.textContent = isDowngrade
      ? 'Listo para restaurar. R+ se reiniciará en la versión seleccionada.'
      : 'Listo para instalar. También se instalará al cerrar la aplicación si eliges esperar.';
  }
  var fill = document.getElementById('update-modal-progress-fill');
  if (fill) fill.style.width = '100%';
  var label = document.getElementById('update-modal-progress-label');
  if (label) label.textContent = 'Descarga completa.';
  wireUpdateReadyActions(isDowngrade);
  showUpdateModal();
}

function handleUpdateNotAvailable(payload) {
  resetUpdateCheckButtons();
  var wasRepair = updaterState.pendingRepairUpdateCheck;
  updaterState.pendingRepairUpdateCheck = false;
  updaterState.pendingUpdaterTargetVersion = null;
  updaterState.pendingUpdaterIsPrerelease = false;
  syncUpdateModalChannelPill(false);
  if (wasRepair || (payload && payload.reinstallFailed)) {
    var v = payload && payload.version ? String(payload.version) : '';
    var detail = payload && payload.detail ? String(payload.detail) : '';
    var msg =
      'No se encontró en GitHub una build reinstalable' +
      (v ? ' para v' + v : '') +
      '. Publica o actualiza el release en GitHub (latest-mac.yml / latest.yml e instaladores) y vuelve a intentar.';
    if (detail) msg += ' Detalle: ' + detail;
    msg += ' También puedes usar «Abrir instalador en GitHub» en Restaurar versión estable.';
    rt.showToast(msg, 'error');
  } else {
    rt.showToast('R+ está actualizado.', 'success');
  }
}

function handleUpdateError(msg) {
  resetUpdateCheckButtons();
  try { sendUpdateTelemetry('fail'); } catch (_e) { void _e; }
  renderUpdateError(msg);
}

function handleDowngradeFailed(payload) {
  resetUpdateCheckButtons();
  renderDowngradeFallback(payload);
}

export {
  handleUpdateAvailable,
  handleUpdateProgress,
  handleUpdateReady,
  handleUpdateNotAvailable,
  handleUpdateError,
  handleDowngradeFailed,
};
