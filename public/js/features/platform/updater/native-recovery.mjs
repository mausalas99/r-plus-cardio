/** Native runtime failure recovery modal on boot. */
import { openSettingsDowngradeSection } from '../../../stable-downgrade-ui.mjs';
import { updaterState } from './state.mjs';
import {
  resetUpdateModalPanels,
  showUpdateModal,
  hideUpdateModal,
} from './modal-ui.mjs';

function hideNativeRecoveryChrome() {
  var wrap = document.getElementById('update-modal-progress-wrap');
  if (wrap) wrap.style.display = 'none';
  var pill = document.getElementById('update-modal-version-pill');
  if (pill) pill.style.display = 'none';
  var err = document.getElementById('update-modal-error');
  if (err) err.style.display = 'none';
}

function populateNativeRecoveryContent(msg) {
  var title = document.getElementById('update-modal-title');
  if (title && title.firstChild && title.firstChild.nodeType === 3) {
    title.firstChild.textContent = 'Problema de instalación';
  }
  var notes = document.getElementById('update-modal-notes');
  if (notes) notes.textContent = msg;
  var state = document.getElementById('update-modal-state');
  if (state) {
    state.textContent =
      'Usa Ajustes → Reinstalar versión actual, Restaurar versión estable, o descarga el instalador desde GitHub Releases.';
  }
}

function populateNativeRecoveryActions() {
  var actions = document.getElementById('update-modal-actions-primary');
  var sec = document.getElementById('update-modal-actions-secondary');
  if (actions) {
    actions.innerHTML = '';
    var settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn-primary';
    settingsBtn.textContent = 'Abrir restaurar versión estable…';
    settingsBtn.onclick = function () {
      hideUpdateModal();
      openSettingsDowngradeSection();
    };
    actions.appendChild(settingsBtn);
    var ghBtn = document.createElement('button');
    ghBtn.className = 'btn-secondary';
    ghBtn.textContent = 'Ver releases en GitHub';
    ghBtn.onclick = function () {
      if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal('https://github.com/mausalas99/r-mas/releases');
      }
    };
    actions.appendChild(ghBtn);
  }
  if (sec) {
    sec.innerHTML = '';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn-secondary';
    closeBtn.textContent = 'Continuar de todos modos';
    closeBtn.onclick = function () { hideUpdateModal(); };
    sec.appendChild(closeBtn);
  }
}

function showNativeRuntimeRecoveryModal(status) {
  if (updaterState.nativeRecoveryModalShown || !status || status.ok) return;
  updaterState.nativeRecoveryModalShown = true;
  var msg =
    (status.userMessage || status.message || 'R+ no pudo cargar un componente nativo.') +
    (status.detail ? '\n\n' + status.detail : '');
  resetUpdateModalPanels();
  populateNativeRecoveryContent(msg);
  hideNativeRecoveryChrome();
  populateNativeRecoveryActions();
  showUpdateModal();
}

function checkNativeRuntimeOnBoot() {
  if (!window.electronAPI || typeof window.electronAPI.getNativeRuntimeStatus !== 'function') {
    return;
  }
  window.electronAPI
    .getNativeRuntimeStatus()
    .then(function (status) {
      if (!status || status.ok) return;
      showNativeRuntimeRecoveryModal(status);
    })
    .catch(function () {});
}

export { showNativeRuntimeRecoveryModal, checkNativeRuntimeOnBoot };
