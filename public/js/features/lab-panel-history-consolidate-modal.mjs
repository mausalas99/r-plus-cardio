import { esc } from '../dom-escape.mjs';
import { notes, saveState } from '../app-state.mjs';
import { labPanelBridge } from './lab-panel-bridge.mjs';
import { rt } from './lab-panel-runtime-state.mjs';

function tipoLabel(tipo) {
  if (tipo === 'cultivo') return 'Cultivos';
  return 'Laboratorio';
}

function clusterLine(sets) {
  return (sets || [])
    .map(function (set) {
      return rt.formatLabHistoryDateSelectLabel(set);
    })
    .join(' · ');
}

function renderOutlierRow(group) {
  var lines = (group.clusters || [])
    .map(function (cluster) {
      return '<li style="margin:4px 0 4px 16px;font-size:12px;color:var(--text-muted);">' + esc(clusterLine(cluster)) + '</li>';
    })
    .join('');
  return (
    '<label class="lab-consolidate-outlier-row" style="display:flex;gap:10px;align-items:flex-start;margin:10px 0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--surface);">' +
    '<input type="checkbox" class="lab-consolidate-outlier-cb" data-gk="' +
    esc(group.groupKey) +
    '" style="margin-top:3px;flex-shrink:0;" />' +
    '<span style="font-size:13px;line-height:1.45;">' +
    '<strong>' +
    esc(group.dayLabel || group.dayKey) +
    ' · ' +
    esc(tipoLabel(group.tipo)) +
    '</strong><br>' +
    '<span style="color:var(--text-muted);">' +
    esc(String(group.setCount)) +
    ' envíos separados (&gt;2 h). Marca para fusionarlos en un solo reporte.</span>' +
    '<ul style="margin:6px 0 0;padding:0;list-style:none;">' +
    lines +
    '</ul></span></label>'
  );
}

/**
 * @param {{ autoMergeCount: number, outlierGroups: object[], dayLabelFromKey: (dk: string) => string }} opts
 */
export function buildLabConsolidateModalHtml(opts) {
  var autoCount = opts.autoMergeCount || 0;
  var outliers = (opts.outlierGroups || []).map(function (g) {
    return Object.assign({}, g, {
      dayLabel: opts.dayLabelFromKey(g.dayKey),
    });
  });
  var autoBlock =
    autoCount > 0
      ? '<p style="margin:0 0 12px;font-size:13px;line-height:1.45;color:var(--text-muted);">' +
        'Se fusionarán automáticamente <strong>' +
        esc(String(autoCount)) +
        '</strong> conjunto(s) con tomas del mismo día a ≤2 h de diferencia.</p>'
      : '';
  var outlierBlock =
    outliers.length > 0
      ? '<p style="margin:0 0 8px;font-size:12px;font-weight:600;color:var(--text-muted);">Outliers (&gt;2 h) — opcional</p>' +
        outliers.map(renderOutlierRow).join('')
      : '';
  return (
    '<div class="lab-conflict-modal" style="max-width:540px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;">' +
    '<h3 style="margin:0 0 8px;">Consolidar historial</h3>' +
    '<p style="font-size:13px;line-height:1.45;margin:0 0 10px;color:var(--text-muted);">Puedes unir envíos del mismo día que quedaron separados por la ventana de 2 h (p. ej. biometría matutina y gases vespertinos).</p>' +
    autoBlock +
    '<div style="overflow-y:auto;flex:1;min-height:0;padding-right:4px;">' +
    outlierBlock +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap;">' +
    '<button type="button" id="lab-consolidate-cancel" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;color:var(--text);">Cancelar</button>' +
    '<button type="button" id="lab-consolidate-ok" style="background:#065F46;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">Consolidar</button>' +
    '</div></div>'
  );
}

/** @param {HTMLElement} backdrop @param {(outlierKeys: string[]) => void} onConfirm */
export function wireLabConsolidateModal(backdrop, onConfirm) {
  document.getElementById('lab-consolidate-cancel').onclick = function () {
    backdrop.remove();
  };
  document.getElementById('lab-consolidate-ok').onclick = function () {
    var keys = [];
    backdrop.querySelectorAll('.lab-consolidate-outlier-cb:checked').forEach(function (cb) {
      var gk = cb.getAttribute('data-gk');
      if (gk) keys.push(gk);
    });
    backdrop.remove();
    onConfirm(keys);
  };
}

export function finishLabConsolidateUi(patientId, mergedCount) {
  saveState({ immediate: true });
  labPanelBridge.renderLabHistoryPanel();
  rt.refreshTendenciasOrCultivosPanel();
  var el = document.querySelector('#note-form textarea[oninput*="estudios"]');
  if (el && patientId && notes[patientId]) {
    el.value = notes[patientId].estudios || '';
  }
  if (mergedCount > 0) {
    rt.addAuditEntry('lab-history-consolidate', 'ok', mergedCount, String(patientId));
    rt.showToast('Fusionados ' + mergedCount + ' conjunto(s) ✓', 'success');
  } else {
    rt.showToast('No había conjuntos para fusionar con la selección actual', 'success');
  }
}
