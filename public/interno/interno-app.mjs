import {
  resolveInternoApiBase,
  parseInternoPath,
  salaKeyFromSlug,
  saveInternoHostOverride,
  isLoopbackHostname,
} from './host-discovery.mjs';

import { escapeHtml, escapeAttr } from '../js/dom-escape.mjs';
const POLL_MS = 30000;
const TOKEN_KEY = 'rpc-interno-token';
const REPORTER_KEY = 'rpc-interno-reporter';

/** @type {Record<string, string>} */
const BADGE_LABELS = {
  consentimiento: 'Consent',
  anestesia: 'Anest',
  familiar: 'Familiar',
  critico: 'Crítico',
  negativas: 'Negativas',
  show: 'Show',
};

/** @type {Record<string, string>} */
const KIND_LABELS = {
  imagen: 'Imagen',
  otro: 'Otro',
};

/** @type {string} */
let apiBase = '';
/** @type {string} */
let salaKey = '';
/** @type {string} */
let token = '';
/** @type {object|null} */
let board = null;
/** @type {string|null} */
let expandedId = null;
/** @type {ReturnType<typeof setInterval>|null} */
let pollTimer = null;
/** @type {WebSocket|null} */
let ws = null;

const root = document.getElementById('interno-app');

function showToast(msg) {
  let el = document.querySelector('.interno-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'interno-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

function loadTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('t');
  if (t) {
    sessionStorage.setItem(TOKEN_KEY, t);
    return t;
  }
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

async function init() {
  const slug = parseInternoPath(window.location.pathname);
  salaKey = salaKeyFromSlug(slug);
  token = loadTokenFromUrl();

  if (!salaKey) {
    root.innerHTML =
      '<div class="interno-error-screen"><p>Enlace inválido. Escanea el QR de tu sala.</p></div>';
    return;
  }
  if (!token) {
    root.innerHTML =
      '<div class="interno-error-screen"><p>Falta el código de acceso. Escanea el QR completo de la sala.</p></div>';
    return;
  }

  root.innerHTML =
    '<div class="interno-empty"><p>Buscando host de guardia en la red…</p></div>';
  apiBase = await resolveInternoApiBase();
  if (!apiBase) {
    renderConnectionError('missing_host');
    return;
  }
  await refreshBoard();
  connectWs();
  pollTimer = setInterval(refreshBoard, POLL_MS);
}

async function apiFetch(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url =
    `${apiBase}/api/interno/v1${path}${sep}` +
    `sala=${encodeURIComponent(salaKey)}&t=${encodeURIComponent(token)}`;
  const headers = Object.assign({}, opts.headers || {}, {
    'X-Interno-Token': token,
    'X-Interno-Sala': salaKey,
  });
  return fetch(url, Object.assign({ credentials: 'same-origin' }, opts, { headers }));
}

async function readJsonResponse(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) return {};
  try {
    return await res.json();
  } catch (_e) {
    return {};
  }
}

async function refreshBoard() {
  try {
    const res = await apiFetch('/board');
    const body = await readJsonResponse(res);
    if (res.ok) {
      board = body;
      render();
      return;
    }
    if (res.status === 403 && body.error === 'interno_inactive') {
      board = { inactive: true, sala: salaKey, patients: [], summary: { total: 0 } };
      render();
      return;
    }
    if (res.status === 403 || res.status === 401 || res.status === 503) {
      renderServerError(body.error || `http_${res.status}`);
      return;
    }
    renderServerError(body.error || 'fetch_failed');
  } catch (_e) {
    if (!board) {
      renderConnectionError('fetch_failed');
    }
  }
}

function renderServerError(code) {
  if (!root) return;
  const pageHost = window.location.hostname;
  const port = window.location.port || '3738';
  const networkOk = !isLoopbackHostname(pageHost);

  const hints = {
    db_unavailable:
      'En la Mac host, abre R+ y asegúrate de que la base clínica esté desbloqueada (pantalla principal cargada).',
    invalid_token:
      'El QR no coincide con el host. En la Mac: Conexión guardia → QR Internos → copia el enlace de nuevo (sin regenerar si no hace falta).',
    interno_inactive:
      'Acceso de internos desactivado para esta sala. En la Mac actívalo en QR Internos (MIP).',
    auth_required: 'Falta el token. Escanea el QR completo otra vez.',
  };
  const hint = hints[code] || 'El host respondió con un error. Revisa R+ en la Mac.';

  root.innerHTML = `<div class="interno-error-screen interno-connect-help">
    <p><strong>No se pudo cargar el tablero.</strong></p>
    <p class="interno-summary">${escapeHtml(hint)}</p>
    ${networkOk ? '' : '<p class="interno-summary">La IP del enlace no es válida para celular (usa <code>192.168.x.x</code>).</p>'}
    <p class="interno-summary">Host: ${escapeHtml(apiBase || `${window.location.protocol}//${pageHost}:${port}`)}</p>
    <p class="interno-summary">Código: ${escapeHtml(code)}</p>
    <button type="button" class="interno-btn-primary" id="interno-retry-board" style="margin-top:1rem">Reintentar</button>
  </div>`;
  root.querySelector('#interno-retry-board')?.addEventListener('click', () => {
    root.innerHTML = '<div class="interno-empty"><p>Conectando…</p></div>';
    void refreshBoard();
  });
}

function renderConnectionError(reason) {
  if (!root) return;
  const pageHost = window.location.hostname;
  const port = window.location.port || '3738';
  const badQr = isLoopbackHostname(pageHost);
  const tried = apiBase ? escapeHtml(apiBase) : '—';
  const hostDefault = badQr ? '' : `${pageHost}:${port}`;

  root.innerHTML = `<div class="interno-error-screen interno-connect-help">
    <p><strong>No se pudo conectar al host de guardia.</strong></p>
    <ul class="interno-help-list">
      ${badQr ? '<li>El QR usa <code>127.0.0.1</code> — en el celular no funciona. Vuelve a copiar el QR desde la Mac host (debe verse una IP tipo <code>192.168.x.x</code>).</li>' : '<li>La página cargó pero la API no responde. Prueba en Safari: <code>/api/interno/v1/ping</code> en la misma URL.</li>'}
      <li>Celular y Mac en la <strong>misma Wi‑Fi</strong> (no datos móviles ni red invitados).</li>
      <li>R+ abierto en la Mac y tú como <strong>host</strong> de guardia.</li>
      <li>En macOS: Ajustes → Red → Firewall → permitir conexiones entrantes a R+ (puerto 3738).</li>
    </ul>
    <p class="interno-summary">Probando: ${tried}</p>
    <details class="interno-host-manual" ${badQr ? 'open' : ''}>
      <summary>Cambiar IP del host</summary>
      <p class="interno-summary">Usa la IP que ves en QR Internos en la Mac (ahora cargaste desde <code>${escapeHtml(pageHost)}</code>).</p>
      <label class="interno-field" for="interno-host-input">
        <span>IP del host</span>
        <input id="interno-host-input" type="text" inputmode="decimal" autocomplete="off" placeholder="192.168.1.164:3738" value="${escapeAttr(hostDefault)}" />
      </label>
      <button type="button" class="interno-btn-primary" id="interno-host-retry">Reintentar</button>
    </details>
  </div>`;

  root.querySelector('#interno-host-retry')?.addEventListener('click', () => {
    void retryWithManualHost();
  });
}

async function retryWithManualHost() {
  const input = document.getElementById('interno-host-input');
  const raw = input?.value?.trim() || '';
  if (!raw) {
    showToast('Escribe la IP de la Mac host');
    return;
  }
  saveInternoHostOverride(raw);
  root.innerHTML = '<div class="interno-empty"><p>Conectando…</p></div>';
  apiBase = await resolveInternoApiBase({ hostOverride: raw });
  if (!apiBase) {
    renderConnectionError('manual_failed');
    return;
  }
  await refreshBoard();
  if (!board) return;
  connectWs();
  if (!pollTimer) pollTimer = setInterval(refreshBoard, POLL_MS);
}

function connectWs() {
  try {
    const wsUrl = apiBase.replace(/^http/i, 'ws') + '/api/interno/v1/ws';
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token, sala: salaKey }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === 'board-changed') void refreshBoard();
      } catch (_e) {
        /* ignore */
      }
    };
    ws.onclose = () => {
      setTimeout(connectWs, 5000);
    };
  } catch (_e) {
    /* polling only */
  }
}

function render() {
  if (!root || !board) return;

  if (board.inactive) {
    root.innerHTML = `<div class="interno-empty"><p><strong>${escapeHtml(board.sala || salaKey)}</strong></p><p>Acceso de internos desactivado o guardia no iniciada.</p></div>`;
    return;
  }

  const summary = board.summary || { total: 0, vitalsOverdue: 0, signosMonitored: 0 };
  const overdue = summary.vitalsOverdue || 0;
  const signosMonitored = summary.signosMonitored || 0;

  let html = `<header class="interno-header">
    <h1>${escapeHtml(board.sala || salaKey)} · Internos</h1>
    <span class="interno-summary">${summary.total} pac · ${signosMonitored} SV · ${overdue} vencidos</span>
    <button type="button" class="interno-btn-icon" id="interno-refresh" aria-label="Actualizar">↻</button>
  </header>`;

  const patients = Array.isArray(board.patients) ? board.patients : [];
  if (!patients.length) {
    html += `<div class="interno-empty"><p>Sin pacientes entregados al R1 de guardia.</p>
      <p class="interno-summary">En la Mac: abre cada paciente en <strong>Entrega</strong>, configura signos vitales y guarda. El MIP solo ve pacientes con entrega registrada al R1 de turno.</p></div>`;
  } else {
    html += '<ul class="interno-list">';
    for (const p of patients) {
      const crit = p.isCritical ? ' is-critical' : '';
      const markers = renderPatientMarkers(p);
      const pendingTags = renderPendingTags(p);
      html += `<li class="interno-row${crit}" data-id="${escapeAttr(p.id)}">
        <span class="interno-bed">${escapeHtml(p.bedLabel)}</span>
        <span class="interno-row-main">
          <span class="interno-name">${escapeHtml(p.nameShort)}</span>
          ${markers}
        </span>
        <span class="interno-chip ${escapeAttr(p.vitals?.cls || 'nominal')}">${escapeHtml(p.vitals?.banner || '')}</span>
        ${pendingTags}
      </li>`;
      if (expandedId === p.id) {
        html += `<li class="interno-detail-wrap"><div class="interno-detail">${renderDetail(p)}</div></li>`;
      }
    }
    html += '</ul>';
  }

  root.innerHTML = html;

  root.querySelector('#interno-refresh')?.addEventListener('click', () => void refreshBoard());
  root.querySelectorAll('.interno-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      expandedId = expandedId === id ? null : id;
      render();
    });
  });
  root.querySelectorAll('[data-vitals-banner]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openVitalsModal(btn.getAttribute('data-vitals-banner'));
    });
  });
  root.querySelectorAll('.interno-estudio-row').forEach((row) => {
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-mark-done]')) return;
      const patientId = row.getAttribute('data-patient-id');
      const itemId = row.getAttribute('data-item-id');
      if (patientId && itemId) openEstudioDetail(patientId, itemId);
    });
  });
  root.querySelectorAll('[data-mark-done]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const patientId = btn.getAttribute('data-patient-id');
      const itemId = btn.getAttribute('data-item-id');
      if (patientId && itemId) void markPendienteComplete(patientId, itemId);
    });
  });
}

/** @param {{ signosPending?: boolean, estudiosPending?: number, pendingCount?: number }} p */
function renderPendingTags(p) {
  const estudios = Number(p.estudiosPending ?? p.pendingCount ?? 0);
  const signos = !!p.signosPending;
  if (!signos && estudios <= 0) {
    return '<span class="interno-pending-tags interno-pending-tags--empty" aria-hidden="true">—</span>';
  }
  const tags = [];
  if (signos) {
    tags.push(
      '<span class="interno-pending-tag interno-pending-tag--signos" title="Signos vitales en entrega">SV</span>'
    );
  }
  if (estudios > 0) {
    tags.push(
      `<span class="interno-pending-tag interno-pending-tag--estudios" title="Estudios / procedimientos">${estudios}</span>`
    );
  }
  return `<span class="interno-pending-tags">${tags.join('')}</span>`;
}

/** @param {string[]} badges */
function renderBadgeChips(badges) {
  const list = Array.isArray(badges) ? badges : [];
  if (!list.length) return '';
  return list
    .map(
      (b) =>
        `<span class="interno-badge interno-badge--${escapeAttr(b)}">${escapeHtml(BADGE_LABELS[b] || b)}</span>`
    )
    .join('');
}

/** @param {{ isCritical?: boolean, signedRefusal?: boolean, show?: boolean }} p */
function patientMarkerKeys(p) {
  const keys = [];
  if (p.isCritical) keys.push('critico');
  if (p.signedRefusal) keys.push('negativas');
  if (p.show) keys.push('show');
  return keys;
}

/** @param {{ isCritical?: boolean, signedRefusal?: boolean, show?: boolean }} p */
function renderPatientMarkers(p) {
  const chips = renderBadgeChips(patientMarkerKeys(p));
  return chips ? `<span class="interno-handoff-markers">${chips}</span>` : '';
}

/** @param {object[]} items */
function sortEstudios(items) {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const ta = a.time || '99:99';
    const tb = b.time || '99:99';
    return ta.localeCompare(tb);
  });
}

/** @param {object} p */
function renderDetail(p) {
  const pend = sortEstudios(Array.isArray(p.pendientes) ? p.pendientes : []);
  const vitalsCls = escapeAttr(p.vitals?.cls || 'nominal');
  const estudiosHtml = pend.length
    ? `<ul class="interno-estudios-list">${pend.map((item) => renderEstudioRow(p.id, item)).join('')}</ul>`
    : '<p class="interno-summary interno-estudios-empty">Sin estudios ni procedimientos.</p>';

  const handoffMarkers = renderPatientMarkers(p);
  const metrics = Array.isArray(p.vitals?.metrics) ? p.vitals.metrics : [];
  const summary = String(p.vitals?.summary || '').trim();
  const metricsHtml = metrics.length
    ? `<p class="interno-vitals-metrics">${metrics.map((m) => `<span class="interno-vitals-metric">${escapeHtml(m)}</span>`).join('')}</p>`
    : summary && summary !== 'Sin signos solicitados'
      ? `<p class="interno-vitals-metrics interno-vitals-metrics--summary">${escapeHtml(summary)}</p>`
      : '<p class="interno-summary">Sin métricas de signos en la entrega.</p>';

  return `<h2>${escapeHtml(p.bedLabel)} · ${escapeHtml(p.nameShort)}</h2>
    ${handoffMarkers ? `<div class="interno-detail-markers">${handoffMarkers}</div>` : ''}
    <h3 class="interno-section-title">Signos vitales</h3>
    <button type="button" class="interno-vitals-banner interno-chip ${vitalsCls}" data-vitals-banner="${escapeAttr(p.id)}" aria-label="Registrar signos vitales">
      <span class="interno-vitals-banner__label">Registrar</span>
      <span class="interno-vitals-banner__text">${escapeHtml(p.vitals?.banner || '')}</span>
      <span class="interno-vitals-banner__freq">${escapeHtml(p.vitals?.frequency || '')}</span>
    </button>
    ${metricsHtml}
    <h3 class="interno-section-title">Estudios y procedimientos</h3>
    ${estudiosHtml}`;
}

/** @param {string} patientId @param {object} item */
function renderEstudioRow(patientId, item) {
  const done = !!item.completed;
  const time = item.time ? escapeHtml(item.time) : '—';
  const chips = renderBadgeChips(item.badges);
  const doneBtn = done
    ? '<span class="interno-estudio-done interno-estudio-done--done" aria-hidden="true">✓</span>'
    : `<button type="button" class="interno-estudio-done" data-mark-done data-patient-id="${escapeAttr(patientId)}" data-item-id="${escapeAttr(item.id)}" aria-label="Marcar hecho">Hecho</button>`;
  return `<li class="interno-estudio-row${done ? ' is-done' : ''}" data-patient-id="${escapeAttr(patientId)}" data-item-id="${escapeAttr(item.id)}" role="button" tabindex="0">
    <span class="interno-estudio-time">${time}</span>
    <span class="interno-estudio-main">
      <span class="interno-estudio-label">${escapeHtml(item.label || '')}</span>
      ${chips ? `<span class="interno-estudio-badges">${chips}</span>` : ''}
    </span>
    ${doneBtn}
  </li>`;
}

/** @param {string} patientId @param {string} itemId */
function findEstudioItem(patientId, itemId) {
  const p = (board?.patients || []).find((x) => x.id === patientId);
  if (!p) return null;
  const item = (p.pendientes || []).find((x) => x.id === itemId);
  return item ? { patient: p, item } : null;
}

/** @param {string} patientId @param {string} itemId */
function openEstudioDetail(patientId, itemId) {
  const found = findEstudioItem(patientId, itemId);
  if (!found) return;
  const { patient: p, item } = found;

  const pendingBadges = Array.isArray(item.badges) ? item.badges : [];
  const reqHtml = pendingBadges.length
    ? pendingBadges
        .map(
          (b) =>
            `<li><span class="interno-badge interno-badge--${escapeAttr(b)}">${escapeHtml(BADGE_LABELS[b] || b)}</span> pendiente</li>`
        )
        .join('')
    : '<li class="interno-summary">Sin requisitos pendientes</li>';

  const kindLabel = item.kind ? KIND_LABELS[item.kind] || item.kind : '—';
  const statusLabel = item.completed ? 'Realizado' : 'Pendiente';

  const bd = document.createElement('div');
  bd.className = 'interno-sheet-backdrop';
  bd.innerHTML = `<div class="interno-sheet" role="dialog" aria-modal="true" aria-labelledby="interno-sheet-title">
    <h3 id="interno-sheet-title">${escapeHtml(item.label || 'Estudio')}</h3>
    <dl class="interno-sheet-dl">
      <div><dt>Hora</dt><dd>${escapeHtml(item.time || '—')}</dd></div>
      <div><dt>Tipo</dt><dd>${escapeHtml(kindLabel)}</dd></div>
      <div><dt>Estado</dt><dd>${escapeHtml(statusLabel)}</dd></div>
      <div><dt>Requisitos</dt><dd><ul class="interno-sheet-reqs">${reqHtml}</ul></dd></div>
    </dl>
    ${
      item.completed
        ? ''
        : `<div class="interno-field" style="margin-top:0.5rem">
      <label for="interno-sheet-reporter">Tu nombre (opcional)</label>
      <input id="interno-sheet-reporter" type="text" autocomplete="name" placeholder="Interno" value="${escapeAttr(sessionStorage.getItem(REPORTER_KEY) || '')}" />
    </div>
    <button type="button" class="interno-btn-primary interno-sheet-mark" id="interno-sheet-hecho">Marcar realizado</button>`
    }
    <button type="button" class="interno-btn-secondary interno-sheet-close" id="interno-sheet-close">Cerrar</button>
  </div>`;

  document.body.appendChild(bd);
  requestAnimationFrame(() => bd.classList.add('open'));

  function close() {
    bd.classList.remove('open');
    setTimeout(() => bd.remove(), 200);
  }

  bd.addEventListener('click', (ev) => {
    if (ev.target === bd) close();
  });
  bd.querySelector('#interno-sheet-close')?.addEventListener('click', close);
  bd.querySelector('#interno-sheet-hecho')?.addEventListener('click', () => {
    const reporterName = bd.querySelector('#interno-sheet-reporter')?.value?.trim() || '';
    if (reporterName) sessionStorage.setItem(REPORTER_KEY, reporterName);
    void markPendienteComplete(patientId, itemId, { reporterName, onSuccess: close });
  });
}

/** @param {string} patientId @param {string} itemId @param {{ reporterName?: string, onSuccess?: () => void }} [opts] */
async function markPendienteComplete(patientId, itemId, opts = {}) {
  const reporterName =
    opts.reporterName ?? sessionStorage.getItem(REPORTER_KEY)?.trim() ?? '';

  try {
    const res = await apiFetch(`/patients/${encodeURIComponent(patientId)}/pendientes/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true, reporterName }),
    });
    const body = await readJsonResponse(res);
    if (!res.ok) {
      const msg =
        body.error === 'item_not_found'
          ? 'Estudio no encontrado'
          : body.error === 'guardia_not_found'
            ? 'Guardia no activa'
            : 'No se pudo marcar';
      showToast(msg);
      return;
    }
    applyPendienteCompleted(patientId, itemId);
    opts.onSuccess?.();
    showToast('Marcado como realizado ✓');
    void refreshBoard();
  } catch (_e) {
    showToast('Error de conexión');
  }
}

/** @param {string} patientId @param {string} itemId */
function applyPendienteCompleted(patientId, itemId) {
  if (!board?.patients) return;
  const p = board.patients.find((x) => x.id === patientId);
  if (!p?.pendientes) return;
  const item = p.pendientes.find((x) => x.id === itemId);
  if (item) item.completed = true;
  if (typeof p.pendingCount === 'number' && p.pendingCount > 0) {
    p.pendingCount -= 1;
  }
  render();
}

/** @type {Record<string, Array<{ key: string, label: string }>>} */
const INTERN_VITAL_INPUTS = {
  ta: [
    { key: 'tas', label: 'TAS' },
    { key: 'tad', label: 'TAD' },
  ],
  fc: [{ key: 'fc', label: 'FC' }],
  fr: [{ key: 'fr', label: 'FR' }],
  temp: [{ key: 'temp', label: 'TEMP' }],
  sat: [{ key: 'sat', label: 'SAT %' }],
};

/** @param {string[]} metricKeys */
function internVitalFieldsHtml(metricKeys) {
  const fields = [];
  for (const mk of metricKeys) {
    if (mk === 'glu') continue;
    const defs = INTERN_VITAL_INPUTS[mk];
    if (defs) fields.push(...defs);
  }
  if (!fields.length) return '';
  return `<div class="interno-field-grid">${fields
    .map((f) => vitalField(f.key, f.label))
    .join('')}</div>`;
}

/** @param {string} patientId */
function openVitalsModal(patientId) {
  const p = (board?.patients || []).find((x) => x.id === patientId);
  if (!p) return;

  let metricKeys = Array.isArray(p.vitals?.metricKeys) ? p.vitals.metricKeys : [];
  if (!metricKeys.length && p.signosPending) {
    metricKeys = ['ta', 'fc', 'fr', 'temp', 'sat', 'glu'];
  }
  const hasGlu = metricKeys.includes('glu');
  const fieldsHtml = internVitalFieldsHtml(metricKeys);
  const metricsHint = Array.isArray(p.vitals?.metrics) && p.vitals.metrics.length
    ? p.vitals.metrics.join(' · ')
    : String(p.vitals?.summary || '').trim();
  const freqHint = String(p.vitals?.frequency || '').trim();
  const planHint = [metricsHint, freqHint].filter(Boolean).join(' · ');
  const noMetrics = !p.signosPending && metricKeys.length === 0;

  const bd = document.createElement('div');
  bd.className = 'interno-modal-backdrop';
  bd.innerHTML = `<div class="interno-modal" role="dialog" aria-modal="true">
    <h3>${escapeHtml(p.bedLabel)} · Signos vitales</h3>
    ${
      planHint
        ? `<p class="interno-summary interno-vitals-plan-hint">${escapeHtml(planHint)}</p>`
        : ''
    }
    ${
      noMetrics
        ? '<p class="interno-summary">Sin signos solicitados en la entrega.</p>'
        : fieldsHtml
    }
    ${
      hasGlu
        ? `<div class="interno-glu-block">
      <label class="interno-summary">Glucometrías</label>
      <div id="interno-glu-rows"></div>
      <button type="button" class="interno-link-btn" id="interno-add-glu">+ Agregar glucometría</button>
    </div>`
        : ''
    }
    <div class="interno-field" style="margin-top:0.75rem">
      <label for="interno-reporter">Tu nombre (opcional)</label>
      <input id="interno-reporter" type="text" autocomplete="name" placeholder="Interno" value="${escapeAttr(sessionStorage.getItem(REPORTER_KEY) || '')}" />
    </div>
    <div class="interno-modal-actions">
      <button type="button" class="interno-btn-secondary" id="interno-cancel">Cancelar</button>
      <button type="button" class="interno-btn-primary" id="interno-save"${noMetrics ? ' disabled' : ''}>Guardar</button>
    </div>
  </div>`;

  document.body.appendChild(bd);
  requestAnimationFrame(() => bd.classList.add('open'));

  const gluHost = bd.querySelector('#interno-glu-rows');
  if (hasGlu && gluHost) {
    addGluRow(gluHost);
    bd.querySelector('#interno-add-glu')?.addEventListener('click', () => addGluRow(gluHost));
  }

  function close() {
    bd.classList.remove('open');
    setTimeout(() => bd.remove(), 200);
  }

  bd.addEventListener('click', (ev) => {
    if (ev.target === bd) close();
  });
  bd.querySelector('#interno-cancel')?.addEventListener('click', close);
  bd.querySelector('#interno-save')?.addEventListener('click', () => {
    void submitVitals(bd, patientId, close);
  });
}

function vitalField(key, label) {
  return `<div class="interno-field"><label>${escapeHtml(label)}</label><input type="number" inputmode="decimal" data-vital="${escapeAttr(key)}" step="any" /></div>`;
}

/** @param {HTMLElement|null} host */
function addGluRow(host) {
  if (!host) return;
  const row = document.createElement('div');
  row.className = 'interno-glu-row';
  row.innerHTML = `<input type="number" inputmode="decimal" data-glu-value placeholder="mg/dL" step="any" />
    <input type="text" data-glu-time placeholder="HH:MM" maxlength="5" />
    <button type="button" class="interno-btn-icon" aria-label="Quitar">×</button>`;
  row.querySelector('button')?.addEventListener('click', () => row.remove());
  host.appendChild(row);
}

/** @param {HTMLElement} bd @param {string} patientId @param {() => void} close */
async function submitVitals(bd, patientId, close) {
  /** @type {Record<string, number>} */
  const vitals = {};
  bd.querySelectorAll('[data-vital]').forEach((el) => {
    const key = el.getAttribute('data-vital');
    const val = el.value.trim();
    if (key && val !== '') vitals[key] = Number(val);
  });

  /** @type {Array<{ value: number, time: string }>} */
  const glucometrias = [];
  bd.querySelectorAll('.interno-glu-row').forEach((row) => {
    const value = row.querySelector('[data-glu-value]')?.value?.trim();
    const time = row.querySelector('[data-glu-time]')?.value?.trim() || '';
    if (value !== '' && value != null) {
      glucometrias.push({ value: Number(value), time });
    }
  });

  const reporterName = bd.querySelector('#interno-reporter')?.value?.trim() || '';
  if (reporterName) sessionStorage.setItem(REPORTER_KEY, reporterName);

  const saveBtn = bd.querySelector('#interno-save');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const res = await apiFetch('/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, vitals, glucometrias, reporterName, sala: salaKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error === 'empty_medicion' ? 'Ingresa al menos un dato' : 'No se pudo guardar');
      return;
    }
    const out = await res.json();
    close();
    expandedId = null;
    await refreshBoard();
    showToast(out.hasAlterations ? 'Registrado · signos alterados' : 'Registrado ✓');
  } catch (_e) {
    showToast('Error de conexión');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

void init();
