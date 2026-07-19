import { fmtDuration, fmtWhen } from '../lib/equipos/equipos-format.mjs';
import { sessionStatus } from '../lib/equipos/equipos-session.mjs';
import { DEVICE_LABELS } from './equipos-rotaciones.mjs';
import {
  clearEquiposAdminKey,
  equiposAdminFetch,
  equiposAdminPhotoUrl,
  EQUIPOS_ADMIN_HISTORY_DAYS,
  EQUIPOS_ADMIN_PAGE_SIZE,
  getEquiposAdminKey,
  isEquiposAdminUnlocked,
  normalizeAdminKey,
  setEquiposAdminKey,
  verifyEquiposAdminKey,
} from './equipos-admin-api.mjs';

import { esc } from '../js/dom-escape.mjs';
const REPORT_KIND_LABELS = {
  malfunction: 'Falla',
  missing_material: 'Material faltante',
};

/** @type {{ apiBase: string, token: string, root: HTMLElement, onExit: () => void, showToast: (msg: string) => void, markBoardDirty?: () => void } | null} */
let ctx = null;

/** @type {'historial' | 'reportes' | 'personas'} */
let activeTab = 'historial';
let sessionOffset = 0;
let reportOffset = 0;

function paginationHtml(offset, total, pageSize, prevAct, nextAct) {
  const page = Math.floor(offset / pageSize) + 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prevDisabled = offset <= 0 ? ' disabled' : '';
  const nextDisabled = offset + pageSize >= total ? ' disabled' : '';
  return (
    `<div class="equipos-admin-pager">` +
    `<button type="button" class="equipos-btn secondary" data-act="${prevAct}"${prevDisabled}>Anterior</button>` +
    `<span class="equipos-admin-pager-meta">Pág. ${page} / ${pages} · ${total} registros · últimos ${EQUIPOS_ADMIN_HISTORY_DAYS} días</span>` +
    `<button type="button" class="equipos-btn secondary" data-act="${nextAct}"${nextDisabled}>Siguiente</button>` +
    `</div>`
  );
}

/** @param {string} photoId */
function photoThumb(photoId, label) {
  if (!photoId || !ctx) return '';
  const src = equiposAdminPhotoUrl(ctx.apiBase, ctx.token, photoId);
  return (
    `<a class="equipos-admin-photo" href="${esc(src)}" target="_blank" rel="noopener" title="${esc(label)}">` +
    `<img src="${esc(src)}" alt="${esc(label)}" loading="lazy" />` +
    `</a>`
  );
}

/** @param {object[]} sessions */
function sessionsToCsv(sessions) {
  const header = [
    'equipo',
    'residente',
    'rotacion',
    'tomo',
    'devolvio',
    'duracion_seg',
    'estado',
    'carga_recoger',
    'carga_entregar',
    'gel_vacio',
    'foto_recoger',
    'foto_entregar',
  ];
  const rows = sessions.map((s) => [
    DEVICE_LABELS[s.device_type] || s.device_type,
    s.holder_name,
    s.holder_rotation,
    s.checked_out_at,
    s.returned_at || '',
    s.duration_seconds ?? '',
    sessionStatus(s),
    s.lumify_pickup_charge_pct ?? '',
    s.lumify_charge_pct ?? '',
    s.lumify_gel_empty === 1 ? 'si' : s.lumify_gel_empty === 0 ? 'no' : '',
    s.pickup_photo_id || '',
    s.return_photo_id || '',
  ]);
  return [header, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/** @param {object[]} reports */
function reportsToCsv(reports) {
  const header = ['tipo', 'equipo', 'residente', 'rotacion', 'fecha', 'mensaje', 'activo', 'atendido_por', 'foto'];
  const rows = reports.map((r) => [
    REPORT_KIND_LABELS[r.kind] || r.kind,
    DEVICE_LABELS[r.device_type] || r.device_type,
    r.reporter_name,
    r.rotation,
    r.created_at,
    r.message || '',
    r.active === 1 ? 'si' : 'no',
    r.acknowledged_by_name ? `${r.acknowledged_by_name} (${r.acknowledged_by_rotation})` : '',
    r.photo_id || '',
  ]);
  return [header, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

/** @param {string} filename @param {string} csv */
function downloadCsv(filename, csv) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchAllSessions() {
  if (!ctx) return [];
  const out = [];
  let offset = 0;
  while (true) {
    const res = await equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/sessions', {
      query: { limit: 100, offset, days: EQUIPOS_ADMIN_HISTORY_DAYS },
    });
    out.push(...(res.sessions || []));
    if (out.length >= res.total) break;
    offset += 100;
  }
  return out;
}

async function renderHistorial(host) {
  host.innerHTML = '<p class="equipos-empty">Cargando historial…</p>';
  const res = await equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/sessions', {
    query: { limit: EQUIPOS_ADMIN_PAGE_SIZE, offset: sessionOffset, days: EQUIPOS_ADMIN_HISTORY_DAYS },
  });
  const sessions = res.sessions || [];
  const cards = sessions.length
    ? sessions
        .map(
          (s) =>
            `<article class="equipos-admin-card">` +
            `<div class="equipos-admin-card-head"><strong>${esc(DEVICE_LABELS[s.device_type])}</strong>` +
            `<span class="equipos-admin-badge">${esc(sessionStatus(s))}</span></div>` +
            `<p class="equipos-admin-meta">${esc(s.holder_name)} · ${esc(s.holder_rotation)}</p>` +
            `<p class="equipos-admin-meta">Tomó ${esc(fmtWhen(s.checked_out_at))}` +
            `${s.returned_at ? ` → Devolvió ${esc(fmtWhen(s.returned_at))}` : ''}</p>` +
            `<p class="equipos-admin-meta">Duración ${esc(fmtDuration(s.duration_seconds))}</p>` +
            `<div class="equipos-admin-photos">` +
            photoThumb(s.pickup_photo_id, 'Foto al recoger') +
            photoThumb(s.return_photo_id, 'Foto al entregar') +
            `</div></article>`
        )
        .join('')
    : '<p class="equipos-empty">Sin sesiones en los últimos 14 días.</p>';

  host.innerHTML =
    `<div class="equipos-admin-toolbar">` +
    `<button type="button" class="equipos-btn secondary" data-act="export-sessions-csv">Exportar CSV</button>` +
    `<button type="button" class="equipos-btn warn secondary equipos-btn-wipe" data-act="wipe-history">Borrar todo el historial y fotos</button>` +
    `</div>` +
    cards +
    paginationHtml(sessionOffset, res.total || 0, EQUIPOS_ADMIN_PAGE_SIZE, 'sess-prev', 'sess-next');
}

async function renderReportes(host) {
  host.innerHTML = '<p class="equipos-empty">Cargando reportes…</p>';
  const res = await equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/reports-list', {
    query: { limit: EQUIPOS_ADMIN_PAGE_SIZE, offset: reportOffset, days: EQUIPOS_ADMIN_HISTORY_DAYS },
  });
  const reports = res.reports || [];
  const cards = reports.length
    ? reports
        .map(
          (r) =>
            `<article class="equipos-admin-card">` +
            `<div class="equipos-admin-card-head"><strong>${esc(REPORT_KIND_LABELS[r.kind])} · ${esc(DEVICE_LABELS[r.device_type])}</strong>` +
            `<span class="equipos-admin-badge${r.active === 1 ? ' is-open' : ''}">${r.active === 1 ? 'Activo' : 'Atendido'}</span></div>` +
            `<p class="equipos-admin-meta">${esc(fmtWhen(r.created_at))} · ${esc(r.reporter_name)} · ${esc(r.rotation)}</p>` +
            `${r.message ? `<p class="equipos-admin-msg">${esc(r.message)}</p>` : ''}` +
            `${r.acknowledged_at ? `<p class="equipos-admin-meta">Atendido por ${esc(r.acknowledged_by_name)} (${esc(r.acknowledged_by_rotation)})</p>` : ''}` +
            `<div class="equipos-admin-photos">${photoThumb(r.photo_id, 'Foto del reporte')}</div>` +
            `</article>`
        )
        .join('')
    : '<p class="equipos-empty">Sin reportes en los últimos 14 días.</p>';

  host.innerHTML =
    `<div class="equipos-admin-toolbar">` +
    `<button type="button" class="equipos-btn secondary" data-act="export-reports-csv">Exportar CSV</button>` +
    `</div>` +
    cards +
    paginationHtml(reportOffset, res.total || 0, EQUIPOS_ADMIN_PAGE_SIZE, 'rep-prev', 'rep-next');
}

async function renderPersonas(host) {
  host.innerHTML = '<p class="equipos-empty">Cargando personas…</p>';
  const res = await equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/people', {
    query: { days: EQUIPOS_ADMIN_HISTORY_DAYS },
  });
  const people = res.people || [];
  host.innerHTML = people.length
    ? `<div class="equipos-admin-table-wrap"><table class="equipos-admin-table">` +
      `<thead><tr><th>Persona</th><th>Sesiones</th><th>Reportes</th><th>Último uso</th></tr></thead><tbody>` +
      people
        .map(
          (p) =>
            `<tr><td>${esc(p.name)} · ${esc(p.rotation)}</td>` +
            `<td>${esc(p.sessions)}</td><td>${esc(p.reports)}</td>` +
            `<td>${esc(fmtWhen(p.last_use))}</td></tr>`
        )
        .join('') +
      `</tbody></table></div>`
    : '<p class="equipos-empty">Sin actividad en los últimos 14 días.</p>';
}

async function renderActiveTab() {
  if (!ctx) return;
  const panel = ctx.root.querySelector('[data-admin-panel]');
  if (!panel) return;
  try {
    if (activeTab === 'historial') await renderHistorial(panel);
    else if (activeTab === 'reportes') await renderReportes(panel);
    else await renderPersonas(panel);
  } catch (e) {
    panel.innerHTML = `<p class="equipos-error-screen"><p>${esc(e.message || 'Error al cargar.')}</p></p>`;
    if (e.code === 'admin_required') {
      clearEquiposAdminKey();
      exitEquiposAdmin();
    }
  }
}

function wireAdminActions() {
  if (!ctx) return;
  ctx.root.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-admin-tab') || 'historial';
      ctx.root.querySelectorAll('[data-admin-tab]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
      void renderActiveTab();
    });
  });
  ctx.root.querySelector('[data-act="admin-exit"]')?.addEventListener('click', () => {
    clearEquiposAdminKey();
    exitEquiposAdmin();
  });
  ctx.root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const act = btn.getAttribute('data-act');
    if (act === 'sess-prev') {
      sessionOffset = Math.max(0, sessionOffset - EQUIPOS_ADMIN_PAGE_SIZE);
      void renderActiveTab();
    } else if (act === 'sess-next') {
      sessionOffset += EQUIPOS_ADMIN_PAGE_SIZE;
      void renderActiveTab();
    } else if (act === 'rep-prev') {
      reportOffset = Math.max(0, reportOffset - EQUIPOS_ADMIN_PAGE_SIZE);
      void renderActiveTab();
    } else if (act === 'rep-next') {
      reportOffset += EQUIPOS_ADMIN_PAGE_SIZE;
      void renderActiveTab();
    } else if (act === 'export-sessions-csv') {
      void fetchAllSessions().then((rows) => {
        downloadCsv(`lista-espera-sesiones-${EQUIPOS_ADMIN_HISTORY_DAYS}d.csv`, sessionsToCsv(rows));
        ctx.showToast('CSV de sesiones descargado.');
      });
    } else if (act === 'export-reports-csv') {
      void equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/reports-list', {
        query: { limit: 100, offset: 0, days: EQUIPOS_ADMIN_HISTORY_DAYS },
      }).then(async (first) => {
        const rows = [...(first.reports || [])];
        let offset = 100;
        while (rows.length < (first.total || 0)) {
          const next = await equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/reports-list', {
            query: { limit: 100, offset, days: EQUIPOS_ADMIN_HISTORY_DAYS },
          });
          rows.push(...(next.reports || []));
          offset += 100;
        }
        downloadCsv(`lista-espera-reportes-${EQUIPOS_ADMIN_HISTORY_DAYS}d.csv`, reportsToCsv(rows));
        ctx.showToast('CSV de reportes descargado.');
      });
    } else if (act === 'wipe-history') {
      if (
        !confirm(
          '¿Borrar TODO el historial (sesiones, reportes, fotos, eventos) y quitar «Anterior» de la cola? No cambia quién tiene el equipo ahora.'
        )
      ) {
        return;
      }
      if (!confirm('Confirmación final: esta acción no se puede deshacer.')) return;
      void equiposAdminFetch(ctx.apiBase, ctx.token, '/admin/wipe-history', {
        method: 'POST',
        body: {},
      })
        .then((res) => {
          sessionOffset = 0;
          reportOffset = 0;
          ctx.markBoardDirty?.();
          const total = (res.sessions || 0) + (res.reports || 0);
          ctx.showToast(`Historial borrado (${total} registros). Sal de admin para ver la cola limpia.`);
          void renderActiveTab();
        })
        .catch((e) => ctx.showToast(e.message || 'No se pudo borrar el historial.'));
    }
  });
}

function renderAdminShell() {
  if (!ctx) return;
  sessionOffset = 0;
  reportOffset = 0;
  ctx.root.innerHTML =
    `<div class="equipos-admin">` +
    `<div class="equipos-admin-head">` +
    `<h2 class="equipos-admin-title">Panel admin</h2>` +
    `<button type="button" class="equipos-btn secondary" data-act="admin-exit">Salir</button>` +
    `</div>` +
    `<nav class="equipos-admin-nav" aria-label="Secciones admin">` +
    `<button type="button" class="equipos-admin-tab is-active" data-admin-tab="historial">Historial</button>` +
    `<button type="button" class="equipos-admin-tab" data-admin-tab="reportes">Reportes</button>` +
    `<button type="button" class="equipos-admin-tab" data-admin-tab="personas">Personas</button>` +
    `</nav>` +
    `<div class="equipos-admin-panel" data-admin-panel></div>` +
    `</div>`;
  wireAdminActions();
  void renderActiveTab();
}

export function exitEquiposAdmin() {
  if (!ctx) return;
  ctx.onExit();
  ctx = null;
  if (window.location.hash === '#/admin') {
    history.replaceState({}, '', window.location.pathname + window.location.search);
  }
}

/**
 * @param {{ apiBase: string, token: string, root: HTMLElement, onExit: () => void, showToast: (msg: string) => void, markBoardDirty?: () => void }} opts
 */
export function openEquiposAdminDashboard(opts) {
  ctx = opts;
  activeTab = 'historial';
  renderAdminShell();
  window.location.hash = '#/admin';
}

/**
 * @param {{ apiBase: string, token: string, showToast: (msg: string) => void, onUnlocked: () => void }} opts
 */
export function openEquiposAdminUnlock(opts) {
  let hostLabel = '';
  try {
    hostLabel = new URL(opts.apiBase).host;
  } catch {
    hostLabel = opts.apiBase || '';
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'equipos-modal-backdrop';
  backdrop.innerHTML =
    `<div class="equipos-modal equipos-admin-unlock" role="dialog" aria-modal="true">` +
    `<h3>Acceso admin</h3>` +
    `<p class="equipos-admin-unlock-hint">Clave <strong>EQUIPOS_ADMIN_KEY</strong> del worker en <code>${esc(hostLabel)}</code> (la misma que guardas en R+ ⇄ → Lista de espera).</p>` +
    `<label for="eq-admin-key">Clave</label>` +
    `<input type="password" id="eq-admin-key" autocomplete="off" spellcheck="false" />` +
    `<div class="equipos-actions" style="margin-top:14px">` +
    `<button type="button" class="equipos-btn secondary" data-act="cancel">Cancelar</button>` +
    `<button type="button" class="equipos-btn" data-act="ok">Entrar</button>` +
    `</div></div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('[data-act="cancel"]')?.addEventListener('click', close);
  backdrop.querySelector('[data-act="ok"]')?.addEventListener('click', async () => {
    const key = backdrop.querySelector('#eq-admin-key')?.value || '';
    if (!normalizeAdminKey(key)) {
      opts.showToast('Escribe la clave admin.');
      return;
    }
    try {
      await verifyEquiposAdminKey(opts.apiBase, opts.token, key);
      setEquiposAdminKey(key);
      close();
      opts.onUnlocked();
    } catch (e) {
      opts.showToast(e.message || 'Clave incorrecta.');
    }
  });
}

/**
 * @param {{ apiBase: string, token: string, root: HTMLElement, resumeBoard: () => void, showToast: (msg: string) => void, cloudOnly?: boolean, markBoardDirty?: () => void }} opts
 */
export function initEquiposAdmin(opts) {
  const adminBtn = document.getElementById('equipos-admin-btn');
  if (!adminBtn) return;
  if (!opts.cloudOnly) {
    adminBtn.hidden = true;
    return;
  }
  adminBtn.hidden = false;
  adminBtn.addEventListener('click', () => {
    const go = () =>
      openEquiposAdminDashboard({
        apiBase: opts.apiBase,
        token: opts.token,
        root: opts.root,
        showToast: opts.showToast,
        markBoardDirty: opts.markBoardDirty,
        onExit: opts.resumeBoard,
      });
    if (isEquiposAdminUnlocked()) go();
    else {
      openEquiposAdminUnlock({
        apiBase: opts.apiBase,
        token: opts.token,
        showToast: opts.showToast,
        onUnlocked: go,
      });
    }
  });
  if (window.location.hash === '#/admin' && isEquiposAdminUnlocked()) {
    openEquiposAdminDashboard({
      apiBase: opts.apiBase,
      token: opts.token,
      root: opts.root,
      showToast: opts.showToast,
      markBoardDirty: opts.markBoardDirty,
      onExit: opts.resumeBoard,
    });
  }
}

export { isEquiposAdminUnlocked, getEquiposAdminKey };
