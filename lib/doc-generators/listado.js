'use strict';

const { esc, loadDocxTemplate, packDocxBuffer } = require('./shared.js');
const {
  fillListadoDocumentXml,
  injectListadoNumbering,
} = require('./listado-table-body.js');

const CELL_RPR_DEFAULT =
  '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" ' +
  'w:cs="Times New Roman"/><w:color w:val="373435"/>' +
  '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';
const CELL_RPR_BOLD =
  '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" ' +
  'w:cs="Times New Roman"/><w:b/><w:bCs/><w:color w:val="373435"/>' +
  '<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';
const PARA_RPR_DEFAULT =
  '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" ' +
  'w:cs="Times New Roman"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';

const LIST_NUMID_BASE = 35;
const LIST_LVL0_LEFT_DXA = 720;
const LIST_BODY_CHUNK_MAX = 110;

const LIST_LINE_RE = /^\s*([A-Za-zÑñ])\)\s*(.*)$/;

function fmtFecha(isoOrDmy) {
  if (!isoOrDmy) return '';
  const s = String(isoOrDmy).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return s;
}

function mkPara(contentXml, { centered = false, ind = null } = {}) {
  const jc = centered ? '<w:jc w:val="center"/>' : '';
  const indent = ind || '';
  return (
    `<w:p><w:pPr><w:pStyle w:val="TableParagraph"/>${jc}${indent}` +
    `${PARA_RPR_DEFAULT}</w:pPr>${contentXml}</w:p>`
  );
}

function mkRun(text, { bold = false } = {}) {
  const rpr = bold ? CELL_RPR_BOLD : CELL_RPR_DEFAULT;
  return `<w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function bestBreakInWindow(window, minCut = 24) {
  const lim = window.length;
  let best = -1;
  for (const sep of ['. ', '? ', '! ', '; ', ', ', ' ']) {
    const p = window.lastIndexOf(sep);
    if (p >= minCut && p + sep.length > best) {
      best = p + sep.length;
    }
  }
  return best > 0 ? best : lim;
}

function splitLongCellText(text, maxChars = LIST_BODY_CHUNK_MAX) {
  const t = (text || '').trim();
  if (!t) return [''];
  if (t.length <= maxChars) return [t];
  const chunks = [];
  let rest = t;
  while (rest) {
    if (rest.length <= maxChars) {
      chunks.push(rest);
      break;
    }
    const window = rest.slice(0, maxChars);
    let cut = bestBreakInWindow(window);
    if (cut <= 0 || cut >= window.length) {
      cut = maxChars;
    }
    let piece = rest.slice(0, cut).trimEnd();
    if (!piece) {
      cut = Math.min(maxChars, rest.length);
      piece = rest.slice(0, cut).trimEnd();
    }
    chunks.push(piece);
    rest = rest.slice(cut).trimStart();
  }
  return chunks.filter((c) => c);
}

function mkListContinuationPara(chunk) {
  const ind = `<w:ind w:left="${LIST_LVL0_LEFT_DXA}" w:hanging="0"/>`;
  return (
    '<w:p><w:pPr>' +
    '<w:pStyle w:val="TableParagraph"/>' +
    `${ind}` +
    '<w:contextualSpacing/>' +
    `${PARA_RPR_DEFAULT}` +
    '</w:pPr>' +
    `<w:r>${CELL_RPR_DEFAULT}<w:t xml:space="preserve">${esc(chunk)}</w:t></w:r>` +
    '</w:p>'
  );
}

function mkListPara(content, numId) {
  const chunks = splitLongCellText(content);
  if (!chunks.length || (chunks.length === 1 && chunks[0] === '')) {
    return (
      '<w:p><w:pPr>' +
      '<w:pStyle w:val="TableParagraph"/>' +
      `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` +
      '<w:contextualSpacing/>' +
      `${PARA_RPR_DEFAULT}` +
      '</w:pPr></w:p>'
    );
  }
  const first =
    '<w:p><w:pPr>' +
    '<w:pStyle w:val="TableParagraph"/>' +
    `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` +
    '<w:contextualSpacing/>' +
    `${PARA_RPR_DEFAULT}` +
    '</w:pPr>' +
    `<w:r>${CELL_RPR_DEFAULT}<w:t xml:space="preserve">${esc(chunks[0])}</w:t></w:r>` +
    '</w:p>';
  const rest = chunks.slice(1).map((c) => mkListContinuationPara(c)).join('');
  return first + rest;
}

function textToParagraphs(text, numIdAlloc) {
  if (!text) return '<w:p/>';
  const paragraphs = [];
  let currentNumId = null;

  function assignNewNumId() {
    if (!numIdAlloc.used.has(LIST_NUMID_BASE)) {
      numIdAlloc.used.add(LIST_NUMID_BASE);
      return LIST_NUMID_BASE;
    }
    const nid = numIdAlloc.next;
    numIdAlloc.next += 1;
    numIdAlloc.used.add(nid);
    return nid;
  }

  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '');
    const stripped = line.trim();
    if (!stripped) {
      paragraphs.push('<w:p/>');
      currentNumId = null;
      continue;
    }
    const m = line.match(LIST_LINE_RE);
    if (m) {
      const content = m[2];
      if (currentNumId === null) {
        currentNumId = assignNewNumId();
      }
      paragraphs.push(mkListPara(content, currentNumId));
    } else {
      for (const part of splitLongCellText(line)) {
        paragraphs.push(mkPara(mkRun(part, { bold: true })));
      }
      currentNumId = null;
    }
  }
  return paragraphs.join('');
}

function plainCell(widthDxa, text, { centered = false, borders = '' } = {}) {
  const tcpr = `<w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/>${borders}</w:tcPr>`;
  const body = text ? mkPara(mkRun(text), { centered }) : '<w:p/>';
  return `<w:tc>${tcpr}${body}</w:tc>`;
}

function descCell(widthDxa, text, numIdAlloc, { borders = '' } = {}) {
  const tcpr = `<w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/>${borders}</w:tcPr>`;
  const body = textToParagraphs(text, numIdAlloc);
  return `<w:tc>${tcpr}${body}</w:tc>`;
}

function buildProblemRow(fecha, num, activosText, inactivosText, numIdAlloc) {
  const cells =
    plainCell(1542, fmtFecha(fecha), {
      centered: true,
      borders:
        '<w:tcBorders><w:left w:val="nil"/>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="373435"/></w:tcBorders>',
    }) +
    plainCell(599, `${num}.`, {
      centered: true,
      borders:
        '<w:tcBorders>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="373435"/></w:tcBorders>',
    }) +
    descCell(5387, activosText, numIdAlloc, {
      borders:
        '<w:tcBorders>' +
        '<w:right w:val="single" w:sz="6" w:space="0" w:color="373435"/></w:tcBorders>',
    }) +
    descCell(3249, inactivosText, numIdAlloc, {
      borders:
        '<w:tcBorders>' +
        '<w:left w:val="single" w:sz="6" w:space="0" w:color="373435"/>' +
        '<w:right w:val="nil"/></w:tcBorders>',
    });
  return (
    '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="448" w:hRule="atLeast"/>' +
    `</w:trPr>${cells}</w:tr>`
  );
}

async function generateListadoBuffer({ patient, listado, medicos }) {
  const { names, files } = await loadDocxTemplate('template_listado.docx');
  const baseXml = files['word/document.xml'].toString('utf-8');
  const { xml, numIdAlloc } = fillListadoDocumentXml(
    baseXml,
    patient,
    listado,
    medicos,
    buildProblemRow,
  );
  injectListadoNumbering(files, numIdAlloc);
  files['word/document.xml'] = Buffer.from(xml, 'utf-8');
  return packDocxBuffer(files, names);
}

module.exports = {
  generateListadoBuffer,
  fmtFecha,
  buildProblemRow,
  textToParagraphs,
  LIST_NUMID_BASE,
};
