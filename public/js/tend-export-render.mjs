import {
  cellDisplayText,
  colWidthLimits,
  drawRoundRect,
  fitCellText,
  isSomeTheme,
  measureCellContentWidth,
  measureTextWidth,
  resolveTableTheme,
} from './tend-export-helpers.mjs';

function buildTableFonts(theme, isSome) {
  var font = theme.fontSize + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
  return {
    font,
    fontBold: '600 ' + font,
    fontLabel: '600 ' + font,
    fontTitle:
      (isSome ? '600 ' : 'bold ') +
      theme.titleSize +
      'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
    fontHeader:
      '700 ' +
      (isSome ? '10' : '11') +
      'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',
  };
}

function measureLabelColumnWidth(probe, theme, labelHeader, visibleRows, fonts) {
  var labelColW = Math.max(
    theme.labelMin,
    measureTextWidth(probe, labelHeader, fonts.fontHeader) + theme.cellPad * 2
  );
  visibleRows.forEach(function (row) {
    labelColW = Math.max(
      labelColW,
      measureTextWidth(probe, row.label || '', fonts.fontLabel) + theme.cellPad * 2
    );
  });
  if (theme.labelMax > 0) labelColW = Math.min(labelColW, theme.labelMax);
  return labelColW;
}

function measureDataColumnWidths(probe, model, theme, visibleCols, visibleRows, fonts, isSome) {
  return visibleCols.map(function (col, ci) {
    var limits = colWidthLimits(theme, ci);
    var hdr = col.header || '';
    var w = measureTextWidth(probe, hdr, fonts.fontHeader) + theme.cellPad * 2;
    if (isSome) {
      w = Math.max(w, measureTextWidth(probe, hdr.toUpperCase(), fonts.fontHeader) + theme.cellPad * 2);
    }
    visibleRows.forEach(function (row) {
      var cell = row.cells[model.columns.indexOf(col)];
      if (!cell) return;
      w = Math.max(
        w,
        measureCellContentWidth(probe, cell, theme, fonts.font, fonts.fontBold) + theme.cellPad * 2
      );
    });
    return Math.min(Math.max(w, limits.min), limits.max);
  });
}

export function buildTablePngLayout(model) {
  var visibleCols = model.columns.filter(function (c) {
    return !c.hidden;
  });
  var visibleRows = model.rows.filter(function (r) {
    return !r.hidden;
  });
  if (!visibleCols.length || !visibleRows.length) return null;

  var theme = resolveTableTheme(model);
  var isSome = isSomeTheme(theme);
  var fonts = buildTableFonts(theme, isSome);
  var labelHeader = model.labelHeader || theme.labelHeader;
  var probe = document.createElement('canvas').getContext('2d');
  var labelColW = measureLabelColumnWidth(probe, theme, labelHeader, visibleRows, fonts);
  var colWidths = measureDataColumnWidths(probe, model, theme, visibleCols, visibleRows, fonts, isSome);
  var tableW = labelColW + colWidths.reduce(function (a, b) {
    return a + b;
  }, 0);
  var tableH = theme.headerH + visibleRows.length * theme.rowH;
  var margin = isSome ? 16 : 12;
  var titleH = isSome ? 36 : 22;
  var framePad = theme.outerRadius > 0 ? 1 : 0;

  return {
    model,
    theme,
    isSome,
    fonts,
    labelHeader,
    visibleCols,
    visibleRows,
    labelColW,
    colWidths,
    tableW,
    tableH,
    margin,
    titleH,
    framePad,
    scale: 2,
    canvasW: tableW + margin * 2 + framePad * 2,
    canvasH: tableH + titleH + margin * 2 + framePad * 2,
  };
}

function drawTableTitle(ctx, layout, title) {
  var theme = layout.theme;
  var isSome = layout.isSome;
  var ox = layout.margin + layout.framePad;
  var oy = layout.margin + layout.framePad;
  var titleText = String(title || 'Tabla').trim();

  if (theme.outerRadius > 0) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, ox - 1, oy - 1, layout.tableW + 2, layout.tableH + layout.titleH + 2, theme.outerRadius + 1);
    ctx.stroke();
  }

  ctx.save();
  ctx.font = layout.fonts.fontTitle;
  ctx.fillStyle = isSome ? '#334155' : '#9ca3af';
  ctx.textAlign = theme.titleAlign;
  ctx.textBaseline = 'top';
  var titleX = theme.titleAlign === 'center' ? ox + layout.tableW / 2 : ox;
  var titleY = oy + (isSome ? 10 : 0);
  ctx.fillText(titleText, titleX, titleY);
  if (isSome && titleText) {
    var titleW = measureTextWidth(ctx, titleText, layout.fonts.fontTitle);
    var underlineY = titleY + theme.titleSize + 4;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(titleX - titleW / 2, underlineY);
    ctx.lineTo(titleX + titleW / 2, underlineY);
    ctx.stroke();
  }
  ctx.restore();

  return { tableOx: ox, tableOy: oy + layout.titleH };
}

function fillCell(ctx, x, y, w, h, fill) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
}

function strokeCell(ctx, x, y, w, h) {
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawSomeFlagCell(ctx, cell, theme, colWidth, rowY, rowH, cellPad, font, fontBold, cx) {
  var flag = String(cell.flag).toUpperCase();
  var valuePart = cell.text != null ? String(cell.text) : '—';
  var flagFont = '700 ' + theme.fontSize + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
  ctx.font = flagFont;
  ctx.fillStyle = '#dc2626';
  var flagLabel = flag + ' ';
  var flagW = measureTextWidth(ctx, flagLabel, flagFont);
  ctx.fillText(flagLabel, cx + cellPad, rowY + rowH / 2);
  ctx.font = cell.abnormal ? fontBold : font;
  ctx.fillStyle = cell.abnormal ? '#dc2626' : '#0f172a';
  ctx.fillText(
    fitCellText(ctx, valuePart, colWidth - cellPad * 2 - flagW, ctx.font),
    cx + cellPad + flagW,
    rowY + rowH / 2
  );
}

function drawBodyCell(ctx, layout, row, rowIndex, colIndex, visibleCol, cx, ry) {
  var theme = layout.theme;
  var isSome = layout.isSome;
  var colIdx = layout.model.columns.indexOf(visibleCol);
  var cell = row.cells[colIdx];
  var abnormal = !!(cell && cell.abnormal);
  var cellText = cellDisplayText(cell, theme);
  var cellFill = abnormal ? '#fef2f2' : theme.zebra && rowIndex % 2 === 1 ? '#f8fafc' : null;
  var colWidth = layout.colWidths[colIndex];
  var rowH = theme.rowH;
  var cellPad = theme.cellPad;

  fillCell(ctx, cx, ry, colWidth, rowH, cellFill);
  strokeCell(ctx, cx, ry, colWidth, rowH);

  if (isSome && cell && cell.flag && cell.flag !== '*' && cellText !== '—') {
    drawSomeFlagCell(ctx, cell, theme, colWidth, ry, rowH, cellPad, layout.fonts.font, layout.fonts.fontBold, cx);
    return;
  }

  ctx.font = abnormal ? layout.fonts.fontBold : layout.fonts.font;
  ctx.fillStyle = abnormal ? '#dc2626' : isSome && colIndex > 0 ? '#64748b' : '#0f172a';
  ctx.fillText(
    fitCellText(ctx, cellText, colWidth - cellPad * 2, ctx.font),
    cx + cellPad,
    ry + rowH / 2
  );
}

function drawTableHeader(ctx, layout, tableOx, tableOy) {
  var theme = layout.theme;
  var isSome = layout.isSome;
  var cellPad = theme.cellPad;
  var headerH = theme.headerH;

  fillCell(ctx, tableOx, tableOy, layout.tableW, headerH, isSome ? '#f1f5f9' : '#f3f4f6');
  ctx.font = layout.fonts.fontHeader;
  ctx.fillStyle = isSome ? '#64748b' : '#6b7280';
  var hx = tableOx;
  strokeCell(ctx, hx, tableOy, layout.labelColW, headerH);
  var headerLabel = isSome ? layout.labelHeader.toUpperCase() : layout.labelHeader;
  ctx.fillText(
    fitCellText(ctx, headerLabel, layout.labelColW - cellPad * 2, layout.fonts.fontHeader),
    hx + cellPad,
    tableOy + headerH / 2
  );
  hx += layout.labelColW;
  for (var ci = 0; ci < layout.visibleCols.length; ci++) {
    strokeCell(ctx, hx, tableOy, layout.colWidths[ci], headerH);
    var hdr = layout.visibleCols[ci].header || '';
    if (isSome) hdr = hdr.toUpperCase();
    ctx.fillText(
      fitCellText(ctx, hdr, layout.colWidths[ci] - cellPad * 2, layout.fonts.fontHeader),
      hx + cellPad,
      tableOy + headerH / 2
    );
    hx += layout.colWidths[ci];
  }
}

function drawTableBody(ctx, layout, tableOx, tableOy) {
  var theme = layout.theme;
  var cellPad = theme.cellPad;
  var rowH = theme.rowH;
  var headerH = theme.headerH;

  for (var ri = 0; ri < layout.visibleRows.length; ri++) {
    var row = layout.visibleRows[ri];
    var ry = tableOy + headerH + ri * rowH;
    var zebraFill = theme.zebra && ri % 2 === 1 ? '#f8fafc' : null;
    var cx = tableOx;

    fillCell(ctx, cx, ry, layout.labelColW, rowH, zebraFill);
    strokeCell(ctx, cx, ry, layout.labelColW, rowH);
    ctx.font = layout.fonts.fontLabel;
    ctx.fillStyle = '#0f172a';
    ctx.fillText(
      fitCellText(ctx, row.label || '', layout.labelColW - cellPad * 2, layout.fonts.fontLabel),
      cx + cellPad,
      ry + rowH / 2
    );
    cx += layout.labelColW;

    for (var cj = 0; cj < layout.visibleCols.length; cj++) {
      drawBodyCell(ctx, layout, row, ri, cj, layout.visibleCols[cj], cx, ry);
      cx += layout.colWidths[cj];
    }
  }
}

export function renderTableModelToCanvas(layout, title) {
  var canvas = document.createElement('canvas');
  canvas.width = layout.canvasW * layout.scale;
  canvas.height = layout.canvasH * layout.scale;
  var ctx = canvas.getContext('2d');
  ctx.scale(layout.scale, layout.scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);

  var origin = drawTableTitle(ctx, layout, title);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  drawTableHeader(ctx, layout, origin.tableOx, origin.tableOy);
  drawTableBody(ctx, layout, origin.tableOx, origin.tableOy);
  return canvas;
}

export function copyTableModelAsPng(model, title, onDone, writePng) {
  var done = typeof onDone === 'function' ? onDone : function () {};
  if (!model || !model.columns || !model.rows) {
    done(false);
    return;
  }

  var layout = buildTablePngLayout(model);
  if (!layout) {
    done(false);
    return;
  }

  var canvas = renderTableModelToCanvas(layout, title);
  canvas.toBlob(function (pngBlob) {
    if (!pngBlob) {
      done(false);
      return;
    }
    writePng(pngBlob, title, done);
  }, 'image/png');
}

