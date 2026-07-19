/** Update modal UI: show/hide, snooze, error rendering, panels. */
import { setAsyncButtonLoading } from '../../../ui-motion.mjs';
import { UPDATE_SNOOZE_KEY, UPDATE_DISMISS_VER_KEY, updaterState } from './state.mjs';

function resetUpdateCheckButtons() {
  ['settings-check-updates-btn', 'settings-repair-update-btn', 'min-version-check-btn'].forEach(
    function (id) {
      setAsyncButtonLoading(document.getElementById(id), false);
    }
  );
}

function getUpdateSnoozeUntil() {
  var raw = localStorage.getItem(UPDATE_SNOOZE_KEY);
  var n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setUpdateSnooze(hours) {
  var h = hours || 24;
  localStorage.setItem(UPDATE_SNOOZE_KEY, String(Date.now() + h * 3600000));
}

function isSnoozeActiveForVersion(version) {
  var dismissed = localStorage.getItem(UPDATE_DISMISS_VER_KEY);
  if (dismissed !== version) return false;
  return Date.now() < getUpdateSnoozeUntil();
}

function markDismissedVersion(version) {
  localStorage.setItem(UPDATE_DISMISS_VER_KEY, version || '');
  setUpdateSnooze(24);
}

function showUpdateModal() {
  var el = document.getElementById('update-modal-backdrop');
  if (!el) return;
  el.style.display = 'flex';
  el.setAttribute('aria-hidden', 'false');
  var modal = document.getElementById('update-modal');
  if (modal) setTimeout(function() { try { modal.focus(); } catch (_e) { void _e; } }, 50);
}

function hideUpdateModal() {
  if (updaterState.updateModalMode === 'downgrade' && window.electronAPI && window.electronAPI.resetUpdateFeed) {
    try { window.electronAPI.resetUpdateFeed(); } catch (_e) { void _e; }
  }
  updaterState.updateModalMode = 'upgrade';
  updaterState.pendingDowngradeVersion = null;
  var el = document.getElementById('update-modal-backdrop');
  if (!el) return;
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');
}

function resetUpdateModalPanels() {
  var err = document.getElementById('update-modal-error');
  var wrap = document.getElementById('update-modal-progress-wrap');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  if (wrap) wrap.style.display = 'block';
}

/** Convierte notas de release (HTML o texto) a texto plano para el modal; evita mostrar etiquetas crudas. */
function stripHtmlToPlainText(html) {
  if (html == null || html === '') return '';
  var raw = String(html).trim();
  if (!raw) return '';
  try {
    var doc = new DOMParser().parseFromString(raw, 'text/html');
    var t = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
    t = t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
    if (t) return t;
  } catch { /* fallback below */ }
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderUpdateError(msg) {
  resetUpdateModalPanels();
  var box = document.getElementById('update-modal-error');
  var state = document.getElementById('update-modal-state');
  var wrap = document.getElementById('update-modal-progress-wrap');
  var label = document.getElementById('update-modal-progress-label');
  var pill = document.getElementById('update-modal-version-pill');
  var notes = document.getElementById('update-modal-notes');
  if (box) { box.style.display = 'block'; box.textContent = msg || 'Error desconocido'; }
  if (state) state.textContent = '';
  if (wrap) wrap.style.display = 'none';
  if (label) label.textContent = '';
  if (pill) pill.style.display = 'none';
  if (notes) notes.textContent = '';
  var title = document.getElementById('update-modal-title');
  if (title && title.firstChild && title.firstChild.nodeType === 3) {
    title.firstChild.textContent = 'Actualizaciones';
  }
  var actions = document.getElementById('update-modal-actions-primary');
  var sec = document.getElementById('update-modal-actions-secondary');
  if (actions) {
    actions.innerHTML = '';
    var retry = document.createElement('button');
    retry.className = 'btn-primary';
    retry.textContent = 'Reintentar';
    retry.onclick = function() {
      resetUpdateModalPanels();
      if (window.electronAPI && window.electronAPI.checkForUpdates) window.electronAPI.checkForUpdates();
      hideUpdateModal();
    };
    actions.appendChild(retry);
  }
  if (sec) sec.innerHTML = '';
  showUpdateModal();
}

export {
  resetUpdateCheckButtons,
  getUpdateSnoozeUntil,
  setUpdateSnooze,
  isSnoozeActiveForVersion,
  markDismissedVersion,
  showUpdateModal,
  hideUpdateModal,
  resetUpdateModalPanels,
  stripHtmlToPlainText,
  renderUpdateError,
};
