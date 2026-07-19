import { sortLabHistoryChronological } from '../tend-core.mjs';
import {
  buildEstudiosCopyLinesFromLabSets,
  groupLabHistoryByDay,
} from '../lab-history-set.mjs';

/** @type {{
 *   getActiveId(): string|null,
 *   ensureParsedLabHistory(pid: string, opts?: object): unknown[],
 *   ensureParsedLabHistoryCached?(pid: string): unknown[],
 *   showToast(msg: string, type?: string): void,
 *   copyToClipboardSafe(text: string): Promise<boolean>,
 * }} */

import { esc } from '../dom-escape.mjs';
let rt = {
  getActiveId() {
    return null;
  },
  ensureParsedLabHistory() {
    return [];
  },
  showToast() {},
  copyToClipboardSafe() {
    return Promise.resolve(false);
  },
};

export function registerLabHistoryBatchCopyRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

function loadPatientHistory() {
  var pid = rt.getActiveId();
  if (!pid) return { pid: null, ordered: [], groups: [] };
  var ordered;
  if (rt.ensureParsedLabHistoryCached) {
    ordered = sortLabHistoryChronological(rt.ensureParsedLabHistoryCached(pid));
  } else {
    ordered = sortLabHistoryChronological(
      rt.ensureParsedLabHistory(pid, { readOnly: true })
    );
  }
  return { pid: pid, ordered: ordered, groups: groupLabHistoryByDay(ordered) };
}

function selectedDayKeysFromBackdrop(backdrop) {
  var keys = [];
  backdrop.querySelectorAll('.lab-batch-copy-cb:checked').forEach(function (cb) {
    var dk = cb.getAttribute('data-day-key');
    if (dk) keys.push(dk);
  });
  return keys;
}

function syncBatchCopyActions(backdrop, ordered) {
  var ta = backdrop.querySelector('#lab-batch-copy-preview');
  var countEl = backdrop.querySelector('#lab-batch-copy-count');
  var copyBtn = backdrop.querySelector('#lab-batch-copy-ok');
  if (!ta) return;
  var keys = selectedDayKeysFromBackdrop(backdrop);
  var n = keys.length;
  if (countEl) {
    countEl.textContent =
      n === 0
        ? 'Ningún día seleccionado — marca al menos uno para copiar'
        : n + ' día' + (n === 1 ? '' : 's') + ' seleccionado' + (n === 1 ? '' : 's');
  }
  if (copyBtn) {
    copyBtn.disabled = n === 0;
    copyBtn.setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
    copyBtn.style.opacity = n === 0 ? '0.55' : '';
    copyBtn.style.cursor = n === 0 ? 'not-allowed' : 'pointer';
  }
  if (!n) {
    ta.value = '';
    ta.placeholder = 'La vista previa aparece al seleccionar uno o más días arriba.';
    return;
  }
  ta.placeholder = '';
  ta.value = buildEstudiosCopyLinesFromLabSets(ordered, { onlyDayKeys: keys }).join('\n');
}

function closeBatchCopyModal(backdrop) {
  if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
}

function buildBatchCopyListHtml(groups) {
  return groups
    .map(function (group) {
      return (
        '<li style="margin:6px 0;">' +
        '<label style="cursor:pointer;display:flex;gap:8px;align-items:flex-start;">' +
        '<input type="checkbox" class="lab-batch-copy-cb" data-day-key="' +
        esc(group.dayKey) +
        '" style="margin-top:3px;flex-shrink:0;" />' +
        '<span>' +
        esc(group.label) +
        '</span></label></li>'
      );
    })
    .join('');
}

function buildBatchCopyModalHtml(listHtml) {
  return (
    '<div class="lab-conflict-modal" style="max-width:560px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;">' +
    '<h3 style="margin:0 0 8px;">Copiar varios días</h3>' +
    '<p style="font-size:13px;line-height:1.45;margin:0 0 10px;color:var(--text-muted);">Marca los días que quieres copiar. El texto usa el mismo formato que el bloque <strong>Estudios</strong> del expediente (laboratorio y cultivos por día).</p>' +
    '<div style="overflow-y:auto;flex:0 1 auto;max-height:28vh;padding-right:4px;">' +
    '<ul style="margin:0;padding-left:0;list-style:none;font-size:13px;">' +
    listHtml +
    '</ul></div>' +
    '<p id="lab-batch-copy-count" style="font-size:12px;color:var(--text-muted);margin:10px 0 6px;">Ningún día seleccionado — marca al menos uno para copiar</p>' +
    '<textarea id="lab-batch-copy-preview" readonly rows="8" placeholder="La vista previa aparece al seleccionar uno o más días arriba." style="width:100%;box-sizing:border-box;font-family:ui-monospace,monospace;font-size:12px;line-height:1.4;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);resize:vertical;flex:1;min-height:120px;"></textarea>' +
    '<div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap;">' +
    '<button type="button" id="lab-batch-copy-none" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Quitar todas</button>' +
    '<button type="button" id="lab-batch-copy-all" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Seleccionar todas</button>' +
    '<button type="button" id="lab-batch-copy-cancel" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Cancelar</button>' +
    '<button type="button" id="lab-batch-copy-ok" disabled aria-disabled="true" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:not-allowed;opacity:0.55;">Copiar al portapapeles</button>' +
    '</div></div>'
  );
}

/** @param {HTMLElement} backdrop @param {{ ordered: unknown[] }} loaded */
function wireBatchCopyModal(backdrop, loaded) {
  function refreshPreview() {
    syncBatchCopyActions(backdrop, loaded.ordered);
  }

  backdrop.querySelectorAll('.lab-batch-copy-cb').forEach(function (cb) {
    cb.addEventListener('change', refreshPreview);
  });
  backdrop.querySelector('#lab-batch-copy-none').onclick = function () {
    backdrop.querySelectorAll('.lab-batch-copy-cb').forEach(function (cb) {
      cb.checked = false;
    });
    refreshPreview();
  };
  backdrop.querySelector('#lab-batch-copy-all').onclick = function () {
    backdrop.querySelectorAll('.lab-batch-copy-cb').forEach(function (cb) {
      cb.checked = true;
    });
    refreshPreview();
  };
  backdrop.querySelector('#lab-batch-copy-cancel').onclick = function () {
    closeBatchCopyModal(backdrop);
  };
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeBatchCopyModal(backdrop);
  });
  backdrop.querySelector('#lab-batch-copy-ok').onclick = async function () {
    var keys = selectedDayKeysFromBackdrop(backdrop);
    if (!keys.length) {
      rt.showToast('Selecciona al menos un día', 'error');
      return;
    }
    var text = buildEstudiosCopyLinesFromLabSets(loaded.ordered, { onlyDayKeys: keys }).join('\n');
    if (!text.trim()) {
      rt.showToast('No hay texto para copiar en los días elegidos', 'error');
      return;
    }
    var ok = await rt.copyToClipboardSafe(text);
    rt.showToast(
      ok
        ? 'Copiados ' + keys.length + ' día' + (keys.length === 1 ? '' : 's') + ' al portapapeles ✓'
        : 'Error al copiar al portapapeles',
      ok ? 'success' : 'error'
    );
    if (ok) closeBatchCopyModal(backdrop);
  };

  refreshPreview();
}

/**
 * Modal para elegir varios días del historial y copiar el bloque de estudios al portapapeles.
 */
export function openLabHistoryBatchCopyModal() {
  if (!rt.getActiveId()) {
    rt.showToast('Selecciona un paciente primero', 'error');
    return;
  }
  var loaded = loadPatientHistory();
  if (!loaded.groups.length) {
    rt.showToast('No hay laboratorios en el historial de este paciente', 'error');
    return;
  }

  var backdrop = document.createElement('div');
  backdrop.className = 'lab-conflict-backdrop';
  backdrop.id = 'lab-batch-copy-backdrop';
  backdrop.innerHTML = buildBatchCopyModalHtml(buildBatchCopyListHtml(loaded.groups));
  document.body.appendChild(backdrop);
  wireBatchCopyModal(backdrop, loaded);
}

export const windowHandlers = {
  openLabHistoryBatchCopyModal,
};
