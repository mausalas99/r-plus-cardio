import {
  STABLE_VERSIONS_RAW_URL,
  filterDowngradeCandidates,
  compareSemverCore,
  buildManualInstallerUrl,
} from '../../lib/update-downgrade.mjs';

import { showSettingsPanel } from './features/settings-help/settings-dropdown.mjs';
import { fetchMinVersionPayload } from './min-version-fetch.mjs';

const RELEASES_PAGE = 'https://github.com/mausalas99/r-mas/releases';

const GITHUB_RELEASES_API =
  'https://api.github.com/repos/mausalas99/r-mas/releases?per_page=40';

/**
 * Solo ofrece versiones con release (y artefactos) en GitHub — evita 6.5.1–6.5.3 borradas.
 * @param {object[]} entries
 * @param {string[] | null} publishedVersions tags sin "v"
 */
export function filterEntriesWithGitHubReleases(entries, publishedVersions) {
  const list = Array.isArray(entries) ? entries : [];
  if (!publishedVersions || !publishedVersions.length) return list;
  const set = new Set(
    publishedVersions.map(function (v) {
      return String(v || '').replace(/^v/, '');
    })
  );
  return list.filter(function (e) {
    return e && set.has(String(e.version).replace(/^v/, ''));
  });
}

export async function fetchGitHubPublishedVersions() {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(GITHUB_RELEASES_API, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data
      .map(function (r) {
        return String((r && r.tag_name) || '').replace(/^v/, '');
      })
      .filter(Boolean);
  } catch {
    return null;
  }
}

/** Fallback alineado con releases que siguen en GitHub (jun 2026). */
const EMBEDDED_STABLE_CATALOG = {
  schema: 1,
  entries: [
    {
      version: '6.5.0',
      label: '6.5.0',
      summary: 'Última 6.5.x en GitHub (Historia Clínica · expediente Sala).',
      recommended: true,
    },
    {
      version: '6.4.2',
      label: '6.4.2',
      summary: 'Estable anterior si necesitas volver más atrás.',
    },
  ],
};

let downgradeUiWired = false;
/** @type {{ showToast: Function, confirmDowngrade: Function } | null} */
let downgradeDeps = null;

export function pickDefaultDowngradeVersion(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const rec = list.find((e) => e.recommended);
  return rec ? rec.version : list[0] ? list[0].version : '';
}

export function isBlockedByMinVersion(target, minVersion) {
  if (!minVersion) return false;
  return compareSemverCore(target, minVersion) < 0;
}

async function getCurrentAppVersion() {
  if (
    typeof window !== 'undefined' &&
    window.electronAPI &&
    typeof window.electronAPI.getAppVersion === 'function'
  ) {
    return window.electronAPI.getAppVersion().catch(function () {
      return '0.0.0';
    });
  }
  return '0.0.0';
}

/**
 * @param {object} raw
 * @param {string} current
 * @param {'remote' | 'embedded'} source
 */
export function resolveDowngradeEntries(raw, current, source) {
  const entries = filterDowngradeCandidates(raw.entries || [], current);
  return { entries, source, updatedAt: raw.updatedAt || '' };
}

async function applyPublishedReleaseFilter(resolved, publishedVersions) {
  const filtered = filterEntriesWithGitHubReleases(resolved.entries, publishedVersions);
  return {
    entries: filtered.length ? filtered : resolved.entries,
    source: resolved.source,
    updatedAt: resolved.updatedAt,
    filteredByGithub: filtered.length > 0 && filtered.length < resolved.entries.length,
  };
}

export async function fetchStableVersionsCatalog() {
  const current = await getCurrentAppVersion();
  const publishedPromise = fetchGitHubPublishedVersions();

  if (typeof fetch !== 'function') {
    const embedded = resolveDowngradeEntries(EMBEDDED_STABLE_CATALOG, current, 'embedded');
    const published = await publishedPromise;
    return applyPublishedReleaseFilter(embedded, published);
  }

  let resolved = null;
  try {
    const res = await fetch(STABLE_VERSIONS_RAW_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('catalog HTTP ' + res.status);
    const raw = await res.json();
    const remote = resolveDowngradeEntries(raw, current, 'remote');
    if (remote.entries.length) resolved = remote;
  } catch {
    /* fall through */
  }
  if (!resolved) {
    resolved = resolveDowngradeEntries(EMBEDDED_STABLE_CATALOG, current, 'embedded');
  }
  const published = await publishedPromise;
  return applyPublishedReleaseFilter(resolved, published);
}

export async function fetchMinVersion() {
  const data = await fetchMinVersionPayload();
  return data?.minVersion ? String(data.minVersion) : null;
}

function openExternal(url) {
  if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
    window.electronAPI.openExternal(url);
  } else {
    try {
      window.open(url, '_blank');
    } catch (_e) { void _e; }
  }
}

async function openManualInstallerForVersion(version) {
  if (window.electronAPI && typeof window.electronAPI.openDowngradeInstaller === 'function') {
    await window.electronAPI.openDowngradeInstaller(version);
    return;
  }
  if (window.electronAPI && typeof window.electronAPI.getPlatform === 'function') {
    const platform = await window.electronAPI.getPlatform();
    const arch =
      platform === 'darwin' && typeof process !== 'undefined' ? process.arch : 'x64';
    openExternal(buildManualInstallerUrl(version, platform, arch));
    return;
  }
  openExternal(RELEASES_PAGE);
}

export const SETTINGS_UPDATES_PANEL_EVENT = 'rpc-settings-updates-panel-shown';

function populateDowngradeSelect(select, entries) {
  select.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Sin versiones anteriores';
    select.appendChild(empty);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  entries.forEach(function (e) {
    const opt = document.createElement('option');
    opt.value = e.version;
    opt.textContent = e.label + (e.summary ? ' — ' + e.summary : '');
    select.appendChild(opt);
  });
  select.value = pickDefaultDowngradeVersion(entries);
}

async function loadDowngradeCatalogBundle() {
  return Promise.race([
    Promise.all([fetchStableVersionsCatalog(), fetchMinVersion(), getCurrentAppVersion()]),
    new Promise(function (_resolve, reject) {
      setTimeout(function () {
        reject(new Error('downgrade catalog timeout'));
      }, 12000);
    }),
  ]);
}

function renderDowngradeLoadError(hint, select, githubBtn) {
  if (hint) {
    hint.textContent =
      'No se pudo cargar el catálogo de versiones. Revisa la red o abre el instalador en GitHub.';
  }
  populateDowngradeSelect(select, []);
  if (githubBtn) {
    githubBtn.disabled = false;
    githubBtn.onclick = function () {
      openExternal(RELEASES_PAGE);
    };
  }
}

function wireDowngradeGithubButton(githubBtn, select, entries) {
  if (!githubBtn) return;
  githubBtn.disabled = false;
  githubBtn.onclick = function () {
    const version = select.value || pickDefaultDowngradeVersion(entries);
    if (version) openManualInstallerForVersion(version);
    else openExternal(RELEASES_PAGE);
  };
}

function wireDowngradeStableButton(deps, btn, select, entries, minVersion) {
  btn.disabled = false;
  btn.onclick = function () {
    const version = select.value;
    if (!version) return;
    if (isBlockedByMinVersion(version, minVersion)) {
      deps.showToast(
        'Esa versión ya no es compatible con tus datos (mínimo v' + minVersion + ').',
        'error'
      );
      return;
    }
    const entry = entries.find(function (e) {
      return e.version === version;
    });
    deps.confirmDowngrade(version, entry);
  };
}

function renderDowngradeHint(hint, catalog) {
  if (!hint) return;
  const srcNote =
    catalog.source === 'embedded'
      ? ' (lista integrada — catálogo en main aún no publicado)'
      : '';
  const ghNote = catalog.filteredByGithub
    ? ' Solo versiones con instalador en GitHub Releases.'
    : '';
  hint.textContent =
    'Si esta versión falla (p. ej. «native binding»), restaura una publicada en GitHub. Tus datos locales no se borran.' +
    ghNote +
    srcNote;
}

/**
 * @param {{ showToast: Function, confirmDowngrade: Function }} deps
 * @returns {Promise<{ entries: object[], source: string }>}
 */
export async function refreshStableDowngradeSettings(deps) {
  const section = document.getElementById('settings-downgrade-section');
  const select = document.getElementById('rpc-stable-downgrade-select');
  const btn = document.getElementById('settings-downgrade-stable-btn');
  const githubBtn = document.getElementById('settings-downgrade-github-btn');
  const hint = document.getElementById('settings-downgrade-hint');
  if (!section || !select || !btn) return { entries: [], source: 'none' };

  if (typeof window === 'undefined' || !window.electronAPI) {
    section.hidden = true;
    return { entries: [], source: 'none' };
  }

  section.hidden = false;
  btn.disabled = true;
  select.disabled = true;
  if (hint) {
    hint.textContent = 'Cargando versiones estables anteriores…';
  }

  let catalog = { entries: [], source: 'none', filteredByGithub: false };
  let minVersion = null;
  let currentVersion = '0.0.0';
  try {
    const results = await loadDowngradeCatalogBundle();
    catalog = results[0];
    minVersion = results[1];
    currentVersion = results[2];
  } catch {
    renderDowngradeLoadError(hint, select, githubBtn);
    return { entries: [], source: 'error' };
  }

  const entries = catalog.entries;
  const source = catalog.source;

  if (!entries.length) {
    if (hint) {
      hint.textContent =
        'No hay versiones anteriores a v' +
        currentVersion +
        ' en el catálogo. Abre Releases en GitHub para instalar manualmente.';
    }
    populateDowngradeSelect(select, []);
    btn.disabled = true;
    wireDowngradeGithubButton(githubBtn, select, entries);
    return { entries, source };
  }

  populateDowngradeSelect(select, entries);
  renderDowngradeHint(hint, catalog);
  wireDowngradeStableButton(deps, btn, select, entries, minVersion);
  wireDowngradeGithubButton(githubBtn, select, entries);

  return { entries, source };
}

export function wireSettingsDowngradeAccordion(deps) {
  if (downgradeUiWired) return;
  downgradeUiWired = true;
  document.addEventListener(SETTINGS_UPDATES_PANEL_EVENT, function () {
    void refreshStableDowngradeSettings(deps);
  });
}

/**
 * @param {{ showToast: Function, confirmDowngrade: Function }} deps
 */
export async function initStableDowngradeSettings(deps) {
  downgradeDeps = deps;
  wireSettingsDowngradeAccordion(deps);
  await refreshStableDowngradeSettings(deps);
}

/** Abre Ajustes y expande la sección de actualizaciones (para recovery desde modal nativo). */
export function openSettingsDowngradeSection() {
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn && typeof settingsBtn.click === 'function') settingsBtn.click();
  const acc = document.getElementById('settings-accordion-updates');
  if (acc) {
    showSettingsPanel('settings-accordion-updates');
    if (downgradeDeps) void refreshStableDowngradeSettings(downgradeDeps);
  }
  const section = document.getElementById('settings-downgrade-section');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
