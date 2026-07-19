const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const {
  renderCensusPdf,
  layoutRows,
  measureRowLineCount,
  pageTableMetrics,
  wrapLabsCellLines,
  wrapPlainCellLines,
} = require('./generate-censo.js');

function makeRow(n) {
  return {
    num: String(n),
    cama: '20' + n,
    pacienteNombre: 'PACIENTE ' + n,
    pacienteMeta: 'ID · 50a M',
    dx: 'DX ' + n + ' + OTRO',
    meds: 'MED A',
    labs: '29/05 — Hb 10',
    pendientes: 'Pendiente',
  };
}

test('7 pacientes caben en 2 páginas (6+1)', async () => {
  var rows = [];
  for (var i = 1; i <= 7; i++) rows.push(makeRow(i));
  var buf = await renderCensusPdf({
    header: { mes: 'MAYO 2026', fecha: '29/05/2026', servicio: 'MI' },
    rows: rows,
  });
  var doc = await PDFDocument.load(buf);
  assert.ok(doc.getPageCount() >= 1 && doc.getPageCount() <= 2);
});

test('labs largos aumentan altura de fila sin truncar líneas', async () => {
  var pdfDoc = await PDFDocument.create();
  var font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  var fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  var layoutCols = {
    cols: [
      { key: 'num', w: 30 },
      { key: 'cama', w: 40 },
      { key: 'paciente', w: 90 },
      { key: 'dx', w: 80 },
      { key: 'meds', w: 80 },
      { key: 'labs', w: 200 },
      { key: 'accesos', w: 50 },
      { key: 'cultivos', w: 80 },
      { key: 'pend', w: 120 },
    ],
  };
  var shortLabs = makeRow(1);
  var longLabs = makeRow(2);
  longLabs.labs = Array.from({ length: 22 }, function (_, i) {
    return '29/05/2026 BH Hb ' + (5 + i * 0.1).toFixed(1) + '* Hto ' + (18 + i) + '*';
  }).join('\n');

  var longLines = measureRowLineCount(font, fontBold, longLabs, layoutCols);
  var shortLines = measureRowLineCount(font, fontBold, shortLabs, layoutCols);
  assert.ok(longLines > shortLines);

  var pageLayouts = layoutRows([shortLabs, longLabs], font, fontBold, layoutCols);
  assert.ok(pageLayouts[0].heights[1] > pageLayouts[0].heights[0]);

  var availH = pageTableMetrics().availH;
  var used = pageLayouts[0].heights.reduce(function (s, h) {
    return s + h;
  }, 0);
  assert.ok(used <= availH + 1);
});

test('labs anchos se envuelven sin elipsis', async () => {
  var pdfDoc = await PDFDocument.create();
  var font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  var fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  var innerW = 90;
  var longPanel =
    'BH · Hb 5.8* Hto 18* Leu 4200 Neu 85% Linf 10% Plt 180000 Glu 145 Cr 1.2 BUN 45 Na 138 K 4.2 Cl 102 Ca 8.5';
  var lines = wrapLabsCellLines(font, fontBold, longPanel, innerW, 0);
  assert.ok(lines.length > 1);
  lines.forEach(function (ln) {
    assert.doesNotMatch(ln, /…$/);
    assert.ok(fontBold.widthOfTextAtSize(ln, 7.25) <= innerW + 0.5);
  });
});

test('pendientes largos se envuelven sin elipsis', async () => {
  var pdfDoc = await PDFDocument.create();
  var font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  var innerW = 70;
  var longPend =
    'Solicitar resonancia magnética de abdomen con contraste y valoración por gastroenterología';
  var lines = wrapPlainCellLines(font, longPend, innerW, 0, 8.25);
  assert.ok(lines.length > 1);
  lines.forEach(function (ln) {
    assert.doesNotMatch(ln, /…$/);
    assert.ok(font.widthOfTextAtSize(ln, 8.25) <= innerW + 0.5);
  });
});
