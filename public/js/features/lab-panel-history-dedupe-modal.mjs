import { notes, saveState } from '../app-state.mjs';
import { syncLabHistoryDeletesToLan } from '../lab-history-lan-sync.mjs';
import { labPanelBridge } from './lab-panel-bridge.mjs';
import { rt } from './lab-panel-runtime-state.mjs';

import { esc } from '../dom-escape.mjs';
function renderLabDedupeRowsHtml(rows) {
  return rows
    .map(function (r) {
      return (
        '<li style="margin:6px 0;"><label style="cursor:pointer;display:flex;gap:8px;align-items:flex-start;">' +
        '<input type="checkbox" class="lab-dedupe-cb" data-pid="' +
        esc(r.patientId) +
        '" data-sid="' +
        esc(r.id) +
        '" checked style="margin-top:3px;flex-shrink:0;" /> <span>' +
        esc(r.summary) +
        '</span></label></li>'
      );
    })
    .join('');
}

function renderLabDedupePatientBlock(sec) {
  const exact = sec.rows.filter(function (r) {
    return r.kind === 'exact';
  });
  const loose = sec.rows.filter(function (r) {
    return r.kind === 'loose';
  });
  const head =
    '<h4 style="margin:12px 0 8px;font-size:14px;font-weight:700;color:var(--text);">' +
    esc(sec.nombre || '—') +
    (sec.registro ? ' <span style="opacity:0.85;font-weight:500">· ' + esc(sec.registro) + '</span>' : '') +
    '</h4>';
  let part = '<div class="lab-dedupe-patient-block">' + head;
  if (exact.length) {
    part +=
      '<p style="margin:0 0 6px;font-size:12px;color:var(--text-muted);font-weight:600;">Duplicados exactos (misma fecha, hora y texto del reporte)</p>' +
      '<ul style="margin:0 0 14px;padding-left:0;list-style:none;max-height:220px;overflow-y:auto;font-size:13px;">' +
      renderLabDedupeRowsHtml(exact) +
      '</ul>';
  }
  if (loose.length) {
    part +=
      '<p style="margin:0 0 6px;font-size:12px;color:var(--text-muted);font-weight:600;">Posibles duplicados (misma fecha/hora y mismos valores numéricos parseados; el texto del reporte puede diferir)</p>' +
      '<ul style="margin:0 0 14px;padding-left:0;list-style:none;max-height:220px;overflow-y:auto;font-size:13px;">' +
      renderLabDedupeRowsHtml(loose) +
      '</ul>';
  }
  return part + '</div>';
}

export function buildLabDedupeModalHtml(sections) {
  const blocks = sections.map(renderLabDedupePatientBlock).join('');
  const defaultCount = sections.reduce(function (acc, s) {
    return acc + s.rows.length;
  }, 0);
  return (
    '<div class="lab-conflict-modal" style="max-width:520px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;">' +
    '<h3 style="margin:0 0 8px;">Sincronizar historial de laboratorio</h3>' +
    '<p style="font-size:13px;line-height:1.45;margin:0 0 10px;color:var(--text-muted);">Marca las entradas a eliminar. Por defecto se seleccionan las copias redundantes y se conserva el conjunto con id más antiguo en cada grupo.</p>' +
    '<div style="overflow-y:auto;flex:1;min-height:0;padding-right:4px;">' +
    blocks +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:14px;justify-content:space-between;flex-wrap:wrap;align-items:center;">' +
    '<span style="font-size:12px;color:var(--text-muted);" id="lab-dedupe-count">' +
    defaultCount +
    ' seleccionada' +
    (defaultCount === 1 ? '' : 's') +
    '</span>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    '<button type="button" id="lab-dedupe-none" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Quitar todas</button>' +
    '<button type="button" id="lab-dedupe-all" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Seleccionar todas</button>' +
    '<button type="button" id="lab-dedupe-cancel" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Cancelar</button>' +
    '<button type="button" id="lab-dedupe-ok" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">Eliminar seleccionadas</button>' +
    '</div></div></div>'
  );
}

/** @param {HTMLElement} backdrop @param {(mapByPatient: Record<string, string[]>) => number} onConfirm */
export function wireLabDedupeModal(backdrop, onConfirm) {
  function updateCount() {
    const n = backdrop.querySelectorAll('.lab-dedupe-cb:checked').length;
    const el = document.getElementById('lab-dedupe-count');
    if (el) el.textContent = n + ' seleccionada' + (n === 1 ? '' : 's');
  }
  backdrop.querySelectorAll('.lab-dedupe-cb').forEach(function (cb) {
    cb.addEventListener('change', updateCount);
  });
  document.getElementById('lab-dedupe-none').onclick = function () {
    backdrop.querySelectorAll('.lab-dedupe-cb').forEach(function (cb) {
      cb.checked = false;
    });
    updateCount();
  };
  document.getElementById('lab-dedupe-all').onclick = function () {
    backdrop.querySelectorAll('.lab-dedupe-cb').forEach(function (cb) {
      cb.checked = true;
    });
    updateCount();
  };
  document.getElementById('lab-dedupe-cancel').onclick = function () {
    backdrop.remove();
  };
  document.getElementById('lab-dedupe-ok').onclick = function () {
    const mapByPatient = {};
    backdrop.querySelectorAll('.lab-dedupe-cb:checked').forEach(function (cb) {
      const pid = cb.getAttribute('data-pid');
      const sid = cb.getAttribute('data-sid');
      if (!pid || !sid) return;
      if (!mapByPatient[pid]) mapByPatient[pid] = [];
      mapByPatient[pid].push(sid);
    });
    backdrop.remove();
    const nSel = Object.keys(mapByPatient).reduce(function (a, pid) {
      return a + mapByPatient[pid].length;
    }, 0);
    if (!nSel) {
      rt.showToast('No seleccionaste entradas para eliminar', 'error');
      return;
    }
    if (typeof rt.pushUndoSnapshot === 'function') {
      rt.pushUndoSnapshot('Eliminar duplicados de historial de labs (' + nSel + ')');
    }
    const removedTotal = onConfirm(mapByPatient);
    Object.keys(mapByPatient).forEach(function (pid) {
      syncLabHistoryDeletesToLan(pid, mapByPatient[pid]);
    });
    saveState({ immediate: true });
    labPanelBridge.renderLabHistoryPanel();
    rt.refreshTendenciasOrCultivosPanel();
    const el = document.querySelector('#note-form textarea[oninput*="estudios"]');
    if (el && rt.getActiveId() && notes[rt.getActiveId()]) {
      el.value = notes[rt.getActiveId()].estudios || '';
    }
    rt.addAuditEntry('lab-history-dedupe', 'ok', removedTotal, Object.keys(mapByPatient).length + ' pacientes');
    rt.showToast('Eliminadas ' + removedTotal + ' entrada' + (removedTotal === 1 ? '' : 's') + ' ✓', 'success');
  };
}
