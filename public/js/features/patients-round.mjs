import { notes, patients } from '../app-state.mjs';
import { isModeSala } from '../mode-features.mjs';
import { sortLabHistoryChronological } from '../tend-core.mjs';
import { ensureParsedLabHistoryCached } from '../lab-history-set.mjs';
import { t, isPaseMode } from './chrome.mjs';
import { rt } from './patients-runtime-state.mjs';
import { patientsBridge } from './patients-bridge.mjs';
import { esc } from './patients-html.mjs';
import { setPatientSearchFilter } from './patients-scope.mjs';
import { renderPatientCardToolbarHtml, patientSidebarCardOpts } from './patients-card-html.mjs';
import { renderPatientSidebarBodyHtml } from '../patient-sidebar-card.mjs';

var _lastRondaNavIds = [];
var _roundOverviewMode = true;
var ROUND_SEEN_LS = 'rpc-round-seen';

export function getRoundOverviewMode() {
  return _roundOverviewMode;
}

export function setRoundOverviewMode(v) {
  _roundOverviewMode = !!v;
}

export function setLastRondaNavIds(ids) {
  _lastRondaNavIds = ids;
}

export function getLastRondaNavIds() {
  return _lastRondaNavIds;
}

export function onPatientSearchInput(val) {
  setPatientSearchFilter(val);
  patientsBridge.renderPatientList();
}

function todayLocalYMD() {
  var d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function getRoundSeenSet() {
  try {
    var raw = localStorage.getItem(ROUND_SEEN_LS);
    var o = raw ? JSON.parse(raw) : {};
    var today = todayLocalYMD();
    if (o.day !== today) return { day: today, ids: [] };
    return { day: today, ids: Array.isArray(o.ids) ? o.ids.map(String) : [] };
  } catch {
    return { day: todayLocalYMD(), ids: [] };
  }
}

function persistRoundSeenSet(s) {
  try {
    localStorage.setItem(ROUND_SEEN_LS, JSON.stringify(s));
  } catch (_e) { void _e; }
}

export function isPatientRoundSeen(patientId) {
  var s = getRoundSeenSet();
  return s.ids.indexOf(String(patientId)) >= 0;
}

export function togglePatientRoundSeen(ev, patientId) {
  if (ev) {
    ev.stopPropagation();
    ev.preventDefault();
  }
  var s = getRoundSeenSet();
  var id = String(patientId);
  var idx = s.ids.indexOf(id);
  if (idx >= 0) s.ids.splice(idx, 1);
  else s.ids.push(id);
  persistRoundSeenSet(s);
  patientsBridge.renderPatientList();
}

function buildRondaLabsMetaHtml(newest) {
  var parts = ['<div class="ronda-labs-meta">'];
  var rawFe =
    newest.fecha === 'Anterior'
      ? ''
      : normalizeFechaForRonda(newest.fecha) || String(newest.fecha || '').trim() || '';
  if (newest.id === 'migrated-anterior') {
    parts.push('<span class="ronda-labs-date">' + esc(rawFe ? 'Anterior · ' + rawFe : 'Anterior') + '</span>');
  } else {
    parts.push('<span class="ronda-labs-date">' + esc(rawFe || '—') + '</span>');
  }
  if (newest.hora && String(newest.hora).trim()) {
    parts.push('<span>' + esc(String(newest.hora).trim().slice(0, 8)) + '</span>');
  }
  var tipo = rt.primaryTipoForLabSet(newest.resLabs);
  if (tipo && tipo !== 'labs') {
    parts.push(
      '<span>' +
        esc(tipo === 'mixed' ? 'Mixto' : tipo === 'cultivo' ? 'Cultivo' : tipo) +
        '</span>'
    );
  }
  parts.push('</div>');
  return parts.join('');
}

function buildRondaLabsLinesHtml(resLabs) {
  var lines = ['<ul class="ronda-labs-lines">'];
  resLabs.forEach(function (L) {
    var line = String(L || '').trim();
    if (!line) return;
    lines.push('<li>' + esc(line) + '</li>');
  });
  lines.push('</ul>');
  return lines.join('');
}

function buildRondaLabsFromHistory(patientId) {
  var hist = sortLabHistoryChronological(ensureParsedLabHistoryCached(patientId));
  if (!hist.length) return '';
  var newest = hist[0];
  if (!newest.resLabs || !newest.resLabs.length) return buildRondaLabsMetaHtml(newest);
  return buildRondaLabsMetaHtml(newest) + buildRondaLabsLinesHtml(newest.resLabs);
}

function buildRondaLabsFromNote(patientId) {
  var n = notes[patientId];
  if (!n || !n.estudios || !String(n.estudios).trim()) return '';
  var lines = String(n.estudios)
    .split('\n')
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
  var skip = { laboratorio: 1, cultivos: 1 };
  var body = [];
  lines.forEach(function (L) {
    if (skip[L.toLowerCase()]) return;
    if (/^fecha|^----/i.test(L)) return;
    body.push('<li>' + esc(L) + '</li>');
  });
  if (!body.length) return '';
  return (
    '<p class="ronda-labs-fallback-label">Desde nota · estudios auxiliares</p>' +
    '<ul class="ronda-labs-lines">' +
      body.join('') +
      '</ul>'
  );
}

function buildRondaRecentLabsBlockHtml(patientId) {
  if (!patientId) {
    return '<p class="ronda-panel-empty">Sin datos.</p>';
  }
  var fromHistory = buildRondaLabsFromHistory(patientId);
  if (fromHistory) return fromHistory;
  var fromNote = buildRondaLabsFromNote(patientId);
  if (fromNote) return fromNote;
  return (
    '<p class="ronda-panel-empty">Sin laboratorios recientes. ' +
    'Puedes cargar o enviar resultados desde la pestaña Laboratorio.</p>'
  );
}

/** Lightweight fecha normalizer for ronda banner (delegates to app when available). */
function normalizeFechaForRonda(fecha) {
  if (typeof rt.normalizeFechaLabHistory === 'function') {
    return rt.normalizeFechaLabHistory(fecha);
  }
  return String(fecha || '').trim();
}

function hideRoundOverviewLayout(overview, classic, fullbar) {
  overview.style.display = 'none';
  classic.style.display = 'flex';
  if (fullbar) {
    fullbar.classList.remove('is-visible');
    fullbar.setAttribute('aria-hidden', 'true');
  }
  var rm = document.getElementById('patient-ronda-todos-mount');
  if (rm) {
    while (rm.firstChild) rm.removeChild(rm.firstChild);
  }
  rt.syncWorkContextChrome();
}

function showRoundOverviewLayout(overview, classic, fullbar) {
  var showOverview =
    !!rt.getActiveId() && rt.getActiveAppTab() === 'nota' && _roundOverviewMode;
  overview.style.display = showOverview ? 'flex' : 'none';
  classic.style.display = showOverview ? 'none' : 'flex';
  if (fullbar) {
    var showBar = !!(rt.getActiveId() && rt.getActiveAppTab() === 'nota' && !showOverview);
    fullbar.classList.toggle('is-visible', showBar);
    fullbar.setAttribute('aria-hidden', showBar ? 'false' : 'true');
  }
  if (showOverview) renderRoundOverviewPanels();
  rt.syncWorkContextChrome();
}

export function syncRoundExpedienteLayout() {
  var overview = document.getElementById('patient-ronda-overview');
  var classic = document.getElementById('patient-expediente-classic');
  var fullbar = document.getElementById('patient-ronda-fullbar');
  if (!overview || !classic) return;

  if (!isPaseMode()) {
    hideRoundOverviewLayout(overview, classic, fullbar);
    return;
  }
  showRoundOverviewLayout(overview, classic, fullbar);
}

function formatRoundPatientMeta(p) {
  if (!p) return '';
  return (
    'Cto. ' +
    (p.cuarto || '—') +
    ' · Cama ' +
    (p.cama || '—') +
    ' · ' +
    (p.servicio || '—') +
    (p.registro ? ' · Reg. ' + String(p.registro) : '')
  );
}

function syncRoundQuickButtons(gala) {
  var qDatos = document.getElementById('ronda-quick-datos');
  if (qDatos) qDatos.style.display = gala ? '' : 'none';
  var qList = document.getElementById('ronda-quick-listado');
  if (qList) qList.style.display = gala ? '' : 'none';
}

export function renderRoundOverviewPanels() {
  if (!isPaseMode() || !_roundOverviewMode || rt.getActiveAppTab() !== 'nota' || !rt.getActiveId()) return;
  var titleEl = document.getElementById('patient-ronda-patient-label');
  var metaEl = document.getElementById('patient-ronda-patient-meta');
  var aid = rt.getActiveId();
  var p = patients.find(function (x) {
    return String(x.id) === String(aid);
  });
  if (titleEl) titleEl.textContent = p ? p.nombre || 'Paciente' : 'Paciente';
  if (metaEl) metaEl.textContent = formatRoundPatientMeta(p);
  var labsBody = document.getElementById('patient-ronda-labs-body');
  if (labsBody) labsBody.innerHTML = buildRondaRecentLabsBlockHtml(aid);
  rt.refreshAllTodoUIs();
  syncRoundQuickButtons(isModeSala(rt.getSettings()));
}

export function closeRondaQuickMoreMenu() {
  document.querySelectorAll(".ronda-quick-more[open]").forEach(function (d) {
    d.removeAttribute("open");
  });
}

export function returnToRoundOverview() {
  if (!isPaseMode()) return;
  _roundOverviewMode = true;
  syncRoundExpedienteLayout();
}

export function openFullExpedienteFromRound(tab) {
  if (!isPaseMode()) return;
  var tname = tab;
  var sala = isModeSala(rt.getSettings());
  if (sala) {
    if (tname === 'notas' || tname === 'indica') tname = 'tend';
    if (!tname) tname = 'tend';
  } else {
    if (!tname) tname = 'notas';
  }
  rt.switchInnerTab(tname);
}

export function advanceRondaPatient(delta) {
  if (!isPaseMode()) return;
  if (!_lastRondaNavIds.length) return;
  var cur = rt.getActiveId() != null ? String(rt.getActiveId()) : '';
  var idx = _lastRondaNavIds.indexOf(cur);
  if (idx < 0) {
    patientsBridge.selectPatient(_lastRondaNavIds[delta > 0 ? 0 : _lastRondaNavIds.length - 1]);
    return;
  }
  var next = idx + delta;
  if (next < 0) next = _lastRondaNavIds.length - 1;
  if (next >= _lastRondaNavIds.length) next = 0;
  patientsBridge.selectPatient(_lastRondaNavIds[next]);
}

export function scrollActiveRondaCardIntoView() {
  if (!rt.getActiveId()) return;
  var list = document.getElementById('patient-list');
  if (!list) return;
  var cards = list.querySelectorAll('.patient-card[data-patient-id]');
  var want = String(rt.getActiveId());
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].getAttribute('data-patient-id') === want) {
      try {
        cards[i].scrollIntoView({
          block: 'nearest',
          behavior: rt.rpcPrefersReducedMotion() ? 'auto' : 'smooth',
        });
      } catch {
        cards[i].scrollIntoView(true);
      }
      break;
    }
  }
}

export function renderPatientRoundRowHtml(p) {
  var pinOn = !!p.pinned;
  var archOn = !!p.archived;
  var seen = isPatientRoundSeen(p.id);
  var seenTitle = typeof t === 'function' ? t('roundMode.seenTitle') : 'Visto en ronda';
  var aid = rt.getActiveId();
  return (
    '<div class="patient-card patient-card--roundrow ' +
    (p.id === aid ? 'active' : '') +
    (seen ? ' patient-card--roundrow-seen' : '') +
    '" data-patient-id="' +
    p.id +
    '" role="button" tabindex="0">' +
    renderPatientCardToolbarHtml(p, pinOn, archOn) +
    '<div class="roundrow-main">' +
    '<div class="roundrow-text">' +
    renderPatientSidebarBodyHtml(p, patientSidebarCardOpts({ roundRow: true })) +
    '</div>' +
    '<button type="button" class="btn-round-seen" title="' +
    esc(seenTitle) +
    '" aria-label="' +
    esc(seenTitle) +
    '" aria-pressed="' +
    (seen ? 'true' : 'false') +
    '" onclick="togglePatientRoundSeen(event,\'' +
    p.id +
    '\')">' +
    (seen ? '✓' : '○') +
    '</button>' +
    '</div></div>'
  );
}
