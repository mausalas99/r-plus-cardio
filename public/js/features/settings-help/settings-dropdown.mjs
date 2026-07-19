/** Settings gear panel: centered modal (como ⇄ / Mi rotación). */
import { isClinicalLocalOnlyMode, readRpcSettings } from '../../clinical-settings.mjs';
import { isMobileWeb } from '../../mobile-web.mjs';
import { isCardionotasLanUiEnabled } from '../cardio/cardionotas-gates.mjs';
import { closeModalAnimated } from '../../ui-motion.mjs';
import { closeConnectionDropdown } from '../lan-sync.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';

let settingsModalChromeWired = false;
let settingsSplitPaneWired = false;

export function isSettingsDropdownOpen() {
  var bg = document.getElementById('settings-dropdown-backdrop');
  return !!(bg && bg.classList.contains('open'));
}

function syncSettingsDropdownA11y(open) {
  var dd = document.getElementById('settings-dropdown');
  var bg = document.getElementById('settings-dropdown-backdrop');
  if (!dd) return;
  dd.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (bg) bg.setAttribute('aria-hidden', open ? 'false' : 'true');
  var trigger = document.getElementById('btn-open-settings');
  if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function focusSettingsDropdownEntry() {
  var activeNav = document.querySelector('.settings-nav-item.is-active');
  if (activeNav && typeof activeNav.focus === 'function') {
    activeNav.focus();
    return;
  }
  var host =
    document.getElementById('settings-panels') ||
    document.getElementById('settings-dropdown-scroll') ||
    document.getElementById('settings-dropdown');
  if (!host) return;
  var target =
    host.querySelector('.btn-settings-help-primary') ||
    host.querySelector('button, summary, [href], input, select, textarea');
  if (target && typeof target.focus === 'function') target.focus();
}

function isSettingsPanelEmpty(panel) {
  if (!panel) return true;
  var body = panel.querySelector(':scope > .settings-acc-body') || panel;
  var clone = body.cloneNode(true);
  clone.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]').forEach(function (el) {
    el.remove();
  });
  var text = String(clone.textContent || '').replace(/\s+/g, '').trim();
  if (text) return false;
  return !clone.querySelector(
    'input, button, select, textarea, img, video, canvas, iframe, [role="button"]'
  );
}

export function syncSettingsNavVisibility() {
  var activeHidden = false;
  document.querySelectorAll('.settings-panel').forEach(function (panel) {
    var empty = isSettingsPanelEmpty(panel);
    var hidden = panel.style.display === 'none' || empty;
    if (empty) {
      panel.hidden = true;
      panel.classList.remove('is-active');
    }
    var btn = document.getElementById('settings-nav-' + panel.id);
    if (!btn) return;
    btn.hidden = hidden;
    if (hidden && btn.classList.contains('is-active')) {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');
      activeHidden = true;
    }
  });
  if (activeHidden) {
    var fallback = document.querySelector('.settings-nav-item:not([hidden])');
    if (fallback) showSettingsPanel(fallback.getAttribute('data-settings-target'));
  }
}

export function showSettingsPanel(panelId) {
  if (!panelId) return;
  initSettingsSplitPane();
  var target = document.getElementById(panelId);
  if (!target || target.style.display === 'none' || isSettingsPanelEmpty(target)) return;
  var found = false;
  document.querySelectorAll('.settings-panel').forEach(function (panel) {
    var active = panel.id === panelId;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
    if (active) found = true;
  });
  document.querySelectorAll('.settings-nav-item').forEach(function (btn) {
    var active = btn.getAttribute('data-settings-target') === panelId && !btn.hidden;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    if (active) found = true;
  });
  if (!found) return;
  var panels = document.getElementById('settings-panels');
  if (panels) panels.scrollTop = 0;
  if (panelId === 'settings-accordion-updates') {
    document.dispatchEvent(new CustomEvent('rpc-settings-updates-panel-shown'));
  }
}

function demoteDetailsToPanel(det) {
  var panel = document.createElement('div');
  Array.from(det.attributes).forEach(function (attr) {
    if (attr.name === 'open') return;
    panel.setAttribute(attr.name, attr.value);
  });
  while (det.firstChild) {
    panel.appendChild(det.firstChild);
  }
  det.replaceWith(panel);
  return panel;
}

function initSettingsSplitPane() {
  if (settingsSplitPaneWired) {
    syncSettingsNavVisibility();
    return;
  }
  var grid = document.querySelector('.settings-accordion-grid');
  if (!grid) return;
  settingsSplitPaneWired = true;

  var items = Array.from(grid.querySelectorAll('.settings-accordion'));
  if (!items.length) return;

  var split = document.createElement('div');
  split.className = 'settings-split';

  var nav = document.createElement('nav');
  nav.className = 'settings-nav';
  nav.id = 'settings-nav';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Secciones de ajustes');

  var panels = document.createElement('div');
  panels.className = 'settings-panels';
  panels.id = 'settings-panels';

  var initialId = '';
  items.forEach(function (det, index) {
    var summary = det.querySelector(':scope > summary');
    var label = summary ? summary.textContent.trim() : 'Sección';
    var panelId = det.id || 'settings-panel-' + index;
    if (!det.id) det.id = panelId;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-nav-item';
    btn.id = 'settings-nav-' + panelId;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('data-settings-target', panelId);
    btn.setAttribute('aria-controls', panelId);
    btn.textContent = label;
    nav.appendChild(btn);

    if (summary) summary.remove();
    var panel = demoteDetailsToPanel(det);
    panel.classList.add('settings-panel');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'settings-nav-' + panelId);
    if (panelId === 'settings-accordion-backup-sync') {
      panel.classList.add('settings-panel--wide');
    }

    panels.appendChild(panel);

    if (!initialId && panel.style.display !== 'none' && !isSettingsPanelEmpty(panel)) {
      initialId = panelId;
    }
  });

  if (!initialId) {
    var firstBtn = nav.querySelector('.settings-nav-item:not([hidden])');
    initialId = firstBtn ? firstBtn.getAttribute('data-settings-target') : '';
  }

  split.appendChild(nav);
  split.appendChild(panels);
  grid.replaceWith(split);

  nav.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.settings-nav-item');
    if (!btn || btn.hidden) return;
    showSettingsPanel(btn.getAttribute('data-settings-target'));
  });

  syncSettingsNavVisibility();
  showSettingsPanel(initialId);
}

function wireSettingsModalChromeOnce() {
  if (settingsModalChromeWired) return;
  settingsModalChromeWired = true;
  document.getElementById('btn-settings-dropdown-close')?.addEventListener('click', () => {
    closeSettingsDropdown();
  });
  var bg = document.getElementById('settings-dropdown-backdrop');
  bg?.addEventListener('click', (ev) => {
    if (ev.target === bg) closeSettingsDropdown();
  });
}

function finishCloseSettingsDropdown() {
  var dd = document.getElementById('settings-dropdown');
  if (dd) dd.classList.remove('open');
  document.body.classList.remove('settings-dropdown-open');
  syncSettingsDropdownA11y(false);
  var trigger = document.getElementById('btn-open-settings');
  if (trigger && typeof trigger.focus === 'function') trigger.focus();
}

export function toggleSettingsSection() {
  toggleSettingsDropdown();
}

export function toggleSettingsDropdown() {
  if (isMobileWeb()) return;
  if (isSettingsDropdownOpen()) {
    closeSettingsDropdown();
    return;
  }
  closeConnectionDropdown();
  wireSettingsModalChromeOnce();
  var dd = document.getElementById('settings-dropdown');
  var bg = document.getElementById('settings-dropdown-backdrop');
  if (!dd || !bg) return;
  bg.classList.add('open');
  dd.classList.add('open');
  document.body.classList.add('settings-dropdown-open');
  syncSettingsDropdownA11y(true);
  getSettingsHelpRuntime().syncPreimportBackupUi();
  getSettingsHelpRuntime().syncSettingsLanHostDiskSection();
  void import('../clinical-sync-mode-settings.mjs')
    .then((m) => {
      if (typeof m.syncClinicalSyncModeSettingsUi === 'function') {
        m.syncClinicalSyncModeSettingsUi();
      }
    })
    .catch(() => {});
  initSettingsSplitPane();
  syncSettingsNavVisibility();
  var scrollHost = document.getElementById('settings-dropdown-scroll');
  if (scrollHost) scrollHost.scrollTop = 0;
  var activePanel = document.querySelector('.settings-panel.is-active');
  if (activePanel && activePanel.id === 'settings-accordion-updates') {
    document.dispatchEvent(new CustomEvent('rpc-settings-updates-panel-shown'));
  }
  focusSettingsDropdownEntry();
}

export function closeSettingsDropdown() {
  var bg = document.getElementById('settings-dropdown-backdrop');
  if (bg && bg.classList.contains('open')) {
    closeModalAnimated(bg, finishCloseSettingsDropdown);
    return;
  }
  finishCloseSettingsDropdown();
}

/** Abre el desplegable y la sección «Respaldos, sync y recuperación». */
export function expandSettingsAccordionBackupSync() {
  if (!isSettingsDropdownOpen()) toggleSettingsDropdown();
  showSettingsPanel('settings-accordion-backup-sync');
}

export function syncTeamSyncHeaderButton() {
  var btn = document.getElementById('btn-header-team-sync');
  if (!btn) return;
  if (!isCardionotasLanUiEnabled() || isClinicalLocalOnlyMode(readRpcSettings())) {
    btn.style.display = 'none';
    return;
  }
  var desktop = !!(window.electronAPI && typeof window.electronAPI.getAppVersion === 'function');
  btn.style.display = desktop || isMobileWeb() ? 'flex' : 'none';
}

export function ensureSettingsDropdownOpen() {
  if (!isSettingsDropdownOpen()) toggleSettingsDropdown();
}
