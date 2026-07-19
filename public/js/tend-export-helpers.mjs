/**
 * Shared helpers for tendencias / SOME table export (TSV + PNG).
 */

export const THEMES = {
  default: {
    labelHeader: 'Analito',
    fontSize: 11,
    rowH: 22,
    headerH: 26,
    cellPad: 8,
    labelMin: 100,
    labelMax: 220,
    colMin: 56,
    colMax: 120,
    titleAlign: 'left',
    titleSize: 10,
    zebra: false,
    outerRadius: 0,
  },
  some: {
    labelHeader: 'Estudio',
    fontSize: 12,
    rowH: 26,
    headerH: 28,
    cellPad: 10,
    labelMin: 140,
    labelMax: 520,
    colMin: [140, 110],
    colMax: [320, 360],
    titleAlign: 'center',
    titleSize: 13,
    zebra: true,
    outerRadius: 8,
  },
  'some-cito': {
    labelHeader: 'Estudio',
    fontSize: 12,
    rowH: 26,
    headerH: 28,
    cellPad: 10,
    labelMin: 140,
    labelMax: 520,
    colMin: [200],
    colMax: [420],
    titleAlign: 'center',
    titleSize: 13,
    zebra: true,
    outerRadius: 8,
  },
};

function isSomeCitoColumns(columns) {
  return (
    columns &&
    columns.length === 1 &&
    /resultado/i.test(String(columns[0].header || ''))
  );
}

function isSomeStandardColumns(columns) {
  return (
    columns &&
    columns.length === 2 &&
    /resultado/i.test(String(columns[0].header || '')) &&
    /referencia/i.test(String(columns[1].header || ''))
  );
}

export function resolveTableTheme(model) {
  if (model?.theme && THEMES[model.theme]) return THEMES[model.theme];
  const columns = model?.columns;
  if (isSomeCitoColumns(columns)) return THEMES['some-cito'];
  if (isSomeStandardColumns(columns)) return THEMES.some;
  return THEMES.default;
}

export function isSomeTheme(theme) {
  return theme === THEMES.some || theme === THEMES['some-cito'];
}

export function measureTextWidth(ctx, text, font) {
  ctx.font = font;
  return ctx.measureText(String(text || '')).width;
}

export function truncateToWidth(ctx, text, maxW, font) {
  var t = String(text == null ? '' : text);
  if (measureTextWidth(ctx, t, font) <= maxW) return t;
  var ell = '…';
  while (t.length > 1 && measureTextWidth(ctx, t + ell, font) > maxW) {
    t = t.slice(0, -1);
  }
  return t + ell;
}

export function fitCellText(ctx, text, maxW, font) {
  var t = String(text == null ? '' : text);
  if (measureTextWidth(ctx, t, font) <= maxW) return t;
  return truncateToWidth(ctx, t, maxW, font);
}

export function drawRoundRect(ctx, x, y, w, h, r) {
  var radius = Math.min(r, w / 2, h / 2);
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function cellDisplayText(cell, theme) {
  if (!cell) return '—';
  var text = cell.text != null ? String(cell.text) : '';
  if (!text) text = '—';
  if (isSomeTheme(theme) && cell.flag && cell.flag !== '*' && text !== '—') {
    return String(cell.flag).toUpperCase() + ' ' + text;
  }
  return text;
}

export function colWidthLimits(theme, colIndex) {
  if (theme.colMin && Array.isArray(theme.colMin)) {
    return {
      min: theme.colMin[colIndex] || theme.colMin[0] || 56,
      max: (theme.colMax && theme.colMax[colIndex]) || theme.colMax[0] || 160,
    };
  }
  return { min: theme.colMin, max: theme.colMax };
}

export function measureCellContentWidth(ctx, cell, theme, font, fontBold) {
  if (!cell) return measureTextWidth(ctx, '—', font);
  var text = cell.text != null ? String(cell.text) : '—';
  if (!text) text = '—';
  if (isSomeTheme(theme) && cell.flag && cell.flag !== '*' && text !== '—') {
    var flagFont = '700 ' + theme.fontSize + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';
    var valueFont = cell.abnormal ? fontBold : font;
    return (
      measureTextWidth(ctx, String(cell.flag).toUpperCase() + ' ', flagFont) +
      measureTextWidth(ctx, text, valueFont)
    );
  }
  var useFont = cell.abnormal ? fontBold : font;
  return measureTextWidth(ctx, cellDisplayText(cell, theme), useFont);
}

export function fallbackCopyText(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function writePngToClipboardOrDownload(pngBlob, title, done) {
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': pngBlob })])
      .then(function () {
        done(true);
      })
      .catch(function () {
        downloadPngBlob(pngBlob, title);
        done(true);
      });
    return;
  }
  downloadPngBlob(pngBlob, title);
  done(true);
}

export function downloadPngBlob(pngBlob, title) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(pngBlob);
  a.download =
    String(title || 'tabla')
      .replace(/[^\w-]+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase() + '.png';
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 500);
}

export function tableDomToExportModel(tableEl) {
  var columns = [];
  var rows = [];
  var ths = tableEl.querySelectorAll('thead th');
  var labelHeader = (ths[0] && (ths[0].textContent || '').trim()) || 'Analito';
  for (var i = 1; i < ths.length; i++) {
    var th = ths[i];
    if (th.classList.contains('is-hidden')) continue;
    columns.push({
      header: (th.textContent || '').replace(/\s+/g, ' ').trim(),
      hidden: false,
    });
  }
  var groupEl = tableEl.closest('.lab-some-group');
  var variant = (groupEl && groupEl.getAttribute('data-variant')) || 'standard';
  var isSomeTable = tableEl.classList.contains('lab-some-table');
  tableEl.querySelectorAll('tbody tr').forEach(function (tr) {
    if (tr.classList.contains('is-hidden')) return;
    var tds = tr.querySelectorAll('td');
    if (tds.length < 2) return;
    var label = (tds[0].textContent || '').replace(/\s+/g, ' ').trim();
    var resCell = tds[1];
    var flagEl = resCell.querySelector('.lab-some-flag');
    var cells = [
      {
        text: (resCell.textContent || '').replace(/^(A|B|CB|CA)\s+/i, '').trim(),
        abnormal:
          resCell.classList.contains('tend-abnormal') || resCell.classList.contains('lab-some-abnormal'),
        flag: flagEl ? flagEl.textContent.trim() : undefined,
      },
    ];
    if (variant !== 'cito' && tds[2]) {
      cells.push({
        text: (tds[2].textContent || '').trim(),
        abnormal: false,
      });
    }
    rows.push({ label: label, hidden: false, cells: cells });
  });
  return {
    columns: columns,
    rows: rows,
    labelHeader: labelHeader,
    theme: isSomeTable ? (variant === 'cito' ? 'some-cito' : 'some') : undefined,
  };
}
