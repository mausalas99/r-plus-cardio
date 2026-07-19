/** In-app release notes modal. */
import {
  RELEASE_NOTES_HIGHLIGHTS,
  RELEASE_NOTES_HIGHLIGHTS_DEFAULT,
} from './release-notes-curated.mjs';

// ── Bloque L · Novedades in-app (release notes) ────────────────────
/** TEMP: true = mostrar novedades en cada arranque (pruebas UX). Poner false antes de publicar. */
export var RELEASE_NOTES_DEV_FORCE_SHOW = false;
var RELEASE_NOTES_SEEN_PREFIX = 'rpc-release-notes-seen-';

function normalizeReleaseVersion(v) {
  return String(v || '')
    .trim()
    .replace(/^v/i, '');
}

function getCuratedReleaseNotes(v) {
  var key = normalizeReleaseVersion(v);
  if (key && RELEASE_NOTES_HIGHLIGHTS[key]) return RELEASE_NOTES_HIGHLIGHTS[key];
  if (!key) return RELEASE_NOTES_HIGHLIGHTS_DEFAULT;
  return null;
}

function stripHtmlFromReleaseBody(html) {
  var raw = html == null ? '' : String(html);
  if (!raw.trim()) return '';
  try {
    var el = document.createElement('div');
    el.innerHTML = raw;
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/** HTML del cuerpo de novedades (solo contenido curado en RELEASE_NOTES_HIGHLIGHTS). */
function releaseNoteBodyHtml(raw) {
  return raw == null ? '' : String(raw);
}

function formatHighlightsPlain(notes) {
  if (!notes || !notes.length) return '';
  return notes
    .map(function (n) {
      var title = n.title ? String(n.title).trim() : '';
      var body = stripHtmlFromReleaseBody(n.body || '');
      if (title && body) return title + ' — ' + body;
      return title || body;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Texto breve para el modal de actualización (no el changelog completo de GitHub). */
export function formatCuratedReleaseNotesPlain(version) {
  return formatHighlightsPlain(getCuratedReleaseNotes(version));
}

/**
 * Modal auto-updater: curated por versión → notas del feed (latest-mac.yml) → default curado.
 * @param {string} targetVersion
 * @param {string} [rawNotesFallback]
 */
export function formatUpdaterReleaseNotesPlain(targetVersion, rawNotesFallback) {
  var curated = formatCuratedReleaseNotesPlain(targetVersion);
  if (curated) return curated;
  var fallback = stripHtmlFromReleaseBody(rawNotesFallback || '');
  if (fallback) return fallback;
  return formatCuratedReleaseNotesPlain('');
}

export function maybeShowReleaseNotesFor(version, prevVersion) {
  if (!version || !prevVersion || prevVersion === version) return;
  try {
    if (localStorage.getItem(RELEASE_NOTES_SEEN_PREFIX + version)) return;
  } catch {
    return;
  }
  setTimeout(function(){ showReleaseNotesModal(version); }, 150);
}

/** Vista previa en desarrollo: ignora “ya visto” y abre al cargar la app. */
export function initReleaseNotesDevPreviewIfEnabled(version) {
  if (!RELEASE_NOTES_DEV_FORCE_SHOW || !version) return;
  try {
    localStorage.removeItem(RELEASE_NOTES_SEEN_PREFIX + version);
  } catch { /* localStorage unavailable */ }
  setTimeout(function () {
    showReleaseNotesModal(version);
  }, 400);
}

var releaseNotesDismissWired = false;

function wireReleaseNotesDismiss() {
  if (releaseNotesDismissWired) return;
  releaseNotesDismissWired = true;
  var bd = document.getElementById('release-notes-backdrop');
  if (!bd) return;
  bd.addEventListener('click', function (ev) {
    if (!bd.classList.contains('open')) return;
    var panel = bd.querySelector('.release-notes-modal');
    if (panel && panel.contains(ev.target)) return;
    closeReleaseNotes();
  });
  document.addEventListener(
    'keydown',
    function (ev) {
      if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
      if (!bd.classList.contains('open')) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeReleaseNotes();
    },
    true
  );
}

function syncReleaseNotesGuardiaCta() {
  var actions = document.querySelector('.release-notes-actions');
  if (!actions) return;
  var existing = document.getElementById('release-notes-open-guardia-guide');
  if (existing) existing.remove();
  var cur = typeof window !== 'undefined' ? window.__RPC_APP_VERSION__ : '';
  var prev = typeof window !== 'undefined' ? window.__RPC_PREV_APP_VERSION__ : '';
  if (!cur || !prev) return;
  void import('../../guardia-v7-gating.mjs').then(function (gating) {
    void import('../../guardia-v7-progress.mjs').then(function (progress) {
      if (
        !gating.shouldOfferGuardiaV7Education({
          prevVersion: prev,
          curVersion: cur,
          needsOnboarding: false,
          trackComplete: progress.isGuardiaV7TrackComplete(),
        })
      ) {
        return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-edit-templates release-notes-guardia-guide-btn';
      btn.id = 'release-notes-open-guardia-guide';
      btn.textContent = 'Abrir guía de guardia';
      btn.addEventListener('click', function () {
        closeReleaseNotes();
        void import('./learn-hub.mjs').then(function (hub) {
          if (typeof hub.openLearnHub === 'function') {
            hub.openLearnHub({ focusTrack: 'guardia-v7' });
          }
        });
      });
      var primary = actions.querySelector('.release-notes-dismiss-btn');
      if (primary) actions.insertBefore(btn, primary);
      else actions.appendChild(btn);
    });
  });
}

function showReleaseNotesModal(version) {
  wireReleaseNotesDismiss();
  var el = document.getElementById('release-notes-backdrop');
  if (!el) return;
  var title = document.getElementById('release-notes-title');
  if (title) title.textContent = 'Novedades de R+ v' + version;
  var list = document.getElementById('release-notes-list');
  if (list) {
    var notes = getCuratedReleaseNotes(version);
    list.innerHTML = '';
    notes.forEach(function (n) {
      var li = document.createElement('li');
      li.className = 'release-notes-item';
      var titleEl = document.createElement('p');
      titleEl.className = 'release-notes-item-title';
      titleEl.textContent = n.title || '';
      li.appendChild(titleEl);
      var bodyEl = document.createElement('p');
      bodyEl.className = 'release-notes-item-body';
      bodyEl.innerHTML = releaseNoteBodyHtml(n.body);
      li.appendChild(bodyEl);
      list.appendChild(li);
    });
  }
  syncReleaseNotesGuardiaCta();
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  el.setAttribute('data-version', version);
  setTimeout(function () {
    var panel = el.querySelector('.release-notes-modal');
    if (panel) panel.focus();
  }, 50);
}

export function closeReleaseNotes() {
  var el = document.getElementById('release-notes-backdrop');
  if (!el) return;
  var v = el.getAttribute('data-version');
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  if (v && !RELEASE_NOTES_DEV_FORCE_SHOW) {
    try { localStorage.setItem(RELEASE_NOTES_SEEN_PREFIX + v, '1'); } catch { /* localStorage unavailable */ }
  }
}
