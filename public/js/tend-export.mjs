/**
 * Export helpers for tendencias group table and SOME lab tables (TSV + PNG). Barrel.
 */

import {
  fallbackCopyText,
  resolveTableTheme,
  tableDomToExportModel,
  writePngToClipboardOrDownload,
} from './tend-export-helpers.mjs';
import { copyTableModelAsPng as renderCopyTableModelAsPng } from './tend-export-render.mjs';

export function buildTableTsv(model) {
  if (!model || !model.columns || !model.rows) return '';
  var theme = resolveTableTheme(model);
  var visibleCols = model.columns.filter(function (c) {
    return !c.hidden;
  });
  var labelHeader = model.labelHeader || theme.labelHeader;
  var lines = [];
  lines.push(
    [labelHeader]
      .concat(
        visibleCols.map(function (c) {
          return c.header || '';
        })
      )
      .join('\t')
  );
  model.rows.forEach(function (row) {
    if (row.hidden) return;
    var cells = row.cells
      .map(function (cell, ci) {
        return { cell: cell, col: model.columns[ci] };
      })
      .filter(function (x) {
        return x.col && !x.col.hidden;
      })
      .map(function (x) {
        return x.cell && x.cell.text != null ? String(x.cell.text) : '';
      });
    lines.push([row.label || ''].concat(cells).join('\t'));
  });
  return lines.join('\n');
}

export function copyTableText(text, onDone) {
  var done = typeof onDone === 'function' ? onDone : function () {};
  var t = text == null ? '' : String(text);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(t)
      .then(function () {
        done(true);
      })
      .catch(function () {
        done(fallbackCopyText(t));
      });
    return;
  }
  done(fallbackCopyText(t));
}

export function copyTableModelAsPng(model, title, onDone) {
  renderCopyTableModelAsPng(model, title, onDone, writePngToClipboardOrDownload);
}

/** @deprecated Prefer copyTableModelAsPng — mantiene compatibilidad si solo hay DOM. */
export function copyTableAsPng(tableEl, title, onDone) {
  if (!tableEl) {
    var done0 = typeof onDone === 'function' ? onDone : function () {};
    done0(false);
    return;
  }
  copyTableModelAsPng(tableDomToExportModel(tableEl), title, onDone);
}
