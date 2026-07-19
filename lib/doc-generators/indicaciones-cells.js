'use strict';

const { esc } = require('./shared.js');

const SZ = '<w:sz w:val="16"/><w:szCs w:val="16"/>';
const LIST_NUMID = '52';

function mkR(text, { bold = false } = {}) {
  const b = bold ? '<w:b/><w:bCs/>' : '';
  return (
    `<w:r><w:rPr>${b}${SZ}</w:rPr>` +
    `<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
  );
}

function mkP(contentXml, { centered = false } = {}) {
  const jc = centered ? '<w:jc w:val="center"/>' : '';
  return `<w:p><w:pPr>${jc}<w:rPr>${SZ}</w:rPr></w:pPr>${contentXml}</w:p>`;
}

function mkListP(text) {
  return (
    '<w:p>' +
    '<w:pPr><w:pStyle w:val="ListParagraph"/>' +
    `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${LIST_NUMID}"/></w:numPr>` +
    `<w:rPr>${SZ}</w:rPr></w:pPr>` +
    `<w:r><w:rPr>${SZ}</w:rPr>` +
    `<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
  );
}

function sectionXml(title, content) {
  let xml = mkP(mkR(title, { bold: true }));
  if (content && String(content).trim()) {
    for (const line of String(content).trim().split('\n')) {
      const stripped = line.trim();
      if (stripped) {
        xml += mkListP(stripped);
      }
    }
  }
  return xml;
}

function cellR0c0(fecha, hora) {
  return (
    '<w:tc><w:tcPr><w:tcW w:w="1980" w:type="dxa"/></w:tcPr>' +
    `${mkP(mkR(fecha))}` +
    `${mkP(mkR(`${hora} HORAS`))}` +
    '</w:tc>'
  );
}

function cellR0c1(servicio) {
  const title = `INDICACIONES POR ${servicio}`;
  return (
    '<w:tc><w:tcPr><w:tcW w:w="8916" w:type="dxa"/></w:tcPr>' +
    `${mkP(mkR(title), { centered: true })}` +
    '</w:tc>'
  );
}

function cellR1c0(medicos) {
  const lines = String(medicos || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let content = mkP('');
  for (const line of lines) {
    content += mkP(mkR(line));
  }
  return (
    '<w:tc><w:tcPr><w:tcW w:w="1980" w:type="dxa"/></w:tcPr>' +
    `${content}</w:tc>`
  );
}

function cellR1c1(ind, servicio, otros) {
  let desc = (ind.descripcion || '').trim();
  if (!desc) {
    desc = `INDICACIONES POR SERVICIO DE ${servicio}`;
  }

  let content = mkP(mkR(desc));

  for (const [title, key] of [
    ['DIETA', 'dieta'],
    ['CUIDADOS', 'cuidados'],
    ['ESTUDIOS', 'estudios'],
    ['MEDICAMENTOS', 'medicamentos'],
    ['INTERCONSULTAS', 'interconsultas'],
  ]) {
    content += sectionXml(title, ind[key] || '');
  }

  for (const item of otros || []) {
    const titulo = (item.titulo || '').trim().toUpperCase();
    const contenido = (item.contenido || '').trim();
    if (titulo) {
      content += sectionXml(titulo, contenido);
    }
  }

  return (
    '<w:tc><w:tcPr><w:tcW w:w="8916" w:type="dxa"/></w:tcPr>' +
    `${content}</w:tc>`
  );
}

module.exports = {
  cellR0c0,
  cellR0c1,
  cellR1c0,
  cellR1c1,
  sectionXml,
};
