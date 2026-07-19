/** SOME table clipboard export wiring. */
import { copyTableModelAsPng, copyTableText } from './tend-export.mjs';
import {
  buildSomeGroupExportModel,
  buildSomeGroupTsv,
  buildSomeDeptExportModel,
  buildSomeDeptTsv,
} from './labs-some-table-export.mjs';

export function exportSomeGroupCopy(group, format, title, onDone) {
  var done = typeof onDone === 'function' ? onDone : function () {};
  var model = buildSomeGroupExportModel(group);
  if (format === 'png') {
    copyTableModelAsPng(model, title || 'Tabla SOME', done);
    return;
  }
  copyTableText(buildSomeGroupTsv(group, title || ''), done);
}

export function exportSomeDeptCopy(dept, format, title, onDone) {
  var done = typeof onDone === 'function' ? onDone : function () {};
  if (!dept) {
    done(false);
    return;
  }
  var label = title || dept.label || 'Tabla';
  if (format === 'png') {
    copyTableModelAsPng(buildSomeDeptExportModel(dept, label), label, done);
    return;
  }
  copyTableText(buildSomeDeptTsv(dept, label), done);
}

function resolveSomeExportLookup(lookup) {
  if (typeof lookup === 'function') {
    return { getDept: lookup, getGroup: null };
  }
  if (lookup && typeof lookup === 'object') {
    return {
      getDept: typeof lookup.getDept === 'function' ? lookup.getDept : null,
      getGroup: typeof lookup.getGroup === 'function' ? lookup.getGroup : null,
    };
  }
  return { getDept: null, getGroup: null };
}

function readSomeExportIndices(btn, groupEl) {
  var di = parseInt(btn.getAttribute('data-dept-index') || '', 10);
  var gi = parseInt(btn.getAttribute('data-group-index') || '', 10);
  if ((!Number.isFinite(di) || !Number.isFinite(gi)) && groupEl) {
    di = parseInt(groupEl.getAttribute('data-dept-index') || '', 10);
    gi = parseInt(groupEl.getAttribute('data-group-index') || '', 10);
  }
  return { deptIndex: di, groupIndex: gi };
}

export function wireSomeTableExportButtons(container, onToast, lookup) {
  if (!container) return;
  var resolved = resolveSomeExportLookup(lookup);
  container.querySelectorAll('.lab-some-export-btn').forEach(function (btn) {
    if (btn.dataset.someWired === '1') return;
    btn.dataset.someWired = '1';
    btn.addEventListener('click', function () {
      var format = btn.getAttribute('data-export');
      var label = btn.getAttribute('data-label') || '';
      if (btn.classList.contains('lab-some-dept-export-btn') && resolved.getDept) {
        var deptIndex = parseInt(btn.getAttribute('data-dept-index') || '', 10);
        var dept = resolved.getDept(deptIndex);
        exportSomeDeptCopy(dept, format, label || (dept && dept.label) || '', function (ok) {
          if (typeof onToast === 'function') {
            onToast(
              ok ? 'Sección copiada ✓' : 'No se pudo copiar la sección',
              ok ? 'success' : 'error'
            );
          }
        });
        return;
      }
      if (!resolved.getGroup) return;
      var groupEl = btn.closest('.lab-some-group');
      var indices = readSomeExportIndices(btn, groupEl);
      if (!Number.isFinite(indices.deptIndex) || !Number.isFinite(indices.groupIndex)) return;
      var group = resolved.getGroup(indices.deptIndex, indices.groupIndex);
      if (!group) return;
      exportSomeGroupCopy(group, format, label, function (ok) {
        if (typeof onToast === 'function') {
          onToast(
            ok ? 'Tabla copiada ✓' : 'No se pudo copiar la tabla',
            ok ? 'success' : 'error'
          );
        }
      });
    });
  });
}
