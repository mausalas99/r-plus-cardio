'use strict';

const { esc } = require('./shared.js');

const LIST_NUMID_BASE = 35;
const LIST_NUMID_DYNAMIC_START = 9000;

function replaceSentinels(xml, pairs) {
  let out = xml;
  for (const [sentinel, value] of pairs) {
    out = out.split(sentinel).join(esc(value));
  }
  return out;
}

function locateListadoTable(xml) {
  const marker = '<!--LISTADO_TABLE_BODY-->';
  const mi = xml.indexOf(marker);
  if (mi === -1) {
    throw new Error('template_listado.docx: falta marcador LISTADO_TABLE_BODY');
  }

  const tstart = xml.lastIndexOf('<w:tbl>', mi);
  if (tstart === -1) {
    throw new Error('template_listado.docx: tabla de listado no encontrada');
  }

  const tr1 = xml.indexOf('<w:tr', tstart);
  const tr1EndRaw = xml.indexOf('</w:tr>', tr1);
  if (tr1 === -1 || tr1EndRaw === -1) {
    throw new Error('template_listado.docx: fila de cabecera incompleta');
  }
  const tr1End = tr1EndRaw + '</w:tr>'.length;
  const stub = xml.slice(tstart + '<w:tbl>'.length, tr1);

  const medicoTrStart = xml.indexOf('<w:tr', mi);
  if (medicoTrStart === -1) {
    throw new Error('template_listado.docx: fila de médicos no encontrada');
  }
  const medicoTrEnd = xml.indexOf('</w:tr>', medicoTrStart) + '</w:tr>'.length;
  const medicoRow = xml.slice(medicoTrStart, medicoTrEnd);
  const tblCloseRaw = xml.indexOf('</w:tbl>', medicoTrEnd);
  if (tblCloseRaw === -1) {
    throw new Error('template_listado.docx: cierre de tabla no encontrado');
  }
  const tblClose = tblCloseRaw + '</w:tbl>'.length;

  return { tr1End, stub, medicoRow, tblClose };
}

function buildProblemTables(activos, inactivos, stub, buildProblemRow) {
  const numIdAlloc = { next: LIST_NUMID_DYNAMIC_START, used: new Set() };
  const problemTables = [];
  const total = Math.max(activos.length, inactivos.length);
  for (let i = 0; i < total; i += 1) {
    const a = i < activos.length ? activos[i] : {};
    const ina = i < inactivos.length ? inactivos[i] : {};
    const fecha = a.fecha || ina.fecha || '';
    const row = buildProblemRow(
      fecha,
      i + 1,
      a.descripcion || '',
      ina.descripcion || '',
      numIdAlloc,
    );
    problemTables.push(`<w:tbl>${stub}${row}</w:tbl>`);
  }
  return { problemTables, numIdAlloc };
}

function injectListadoNumbering(files, numIdAlloc) {
  let numXml = (files['word/numbering.xml'] || Buffer.alloc(0)).toString('utf-8');
  const synthIds = [...numIdAlloc.used]
    .filter((nid) => nid !== LIST_NUMID_BASE)
    .sort((a, b) => a - b);
  if (!numXml || !synthIds.length) return;

  let inject = '';
  for (const nid of synthIds) {
    inject +=
      `<w:num w:numId="${nid}">` +
      '<w:abstractNumId w:val="57"/>' +
      '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' +
      '</w:num>';
  }
  if (numXml.includes('</w:numbering>')) {
    numXml = numXml.replace('</w:numbering>', inject + '</w:numbering>');
    files['word/numbering.xml'] = Buffer.from(numXml, 'utf-8');
  }
}

function fillListadoPatientSentinels(xml, patient) {
  return replaceSentinels(xml, [
    ['~~NOMBRE~~', (patient.nombre || '').toUpperCase()],
    ['~~REGISTRO~~', patient.registro || ''],
    ['~~EDAD~~', String(patient.edad || '')],
    ['~~SEXO~~', (patient.sexo || '').toUpperCase()],
    ['~~AREA~~', (patient.area || '').toUpperCase()],
    ['~~SERVICIO~~', (patient.servicio || '').toUpperCase()],
    ['~~CUARTO~~', patient.cuarto || ''],
    ['~~CAMA~~', patient.cama || ''],
  ]);
}

function fillListadoMedicoSentinels(xml, medicos) {
  return replaceSentinels(xml, [
    ['~~MEDICO_PROFESOR~~', medicos.profesor || ''],
    ['~~MEDICO_R4~~', medicos.r4 || ''],
    ['~~MEDICO_R2~~', medicos.r2 || ''],
    ['~~MEDICO_R1A~~', medicos.r1a || ''],
    ['~~MEDICO_R1B~~', medicos.r1b || ''],
  ]);
}

function fillListadoDocumentXml(xml, patient, listado, medicos, buildProblemRow) {
  patient = patient || {};
  listado = listado || {};
  medicos = medicos || {};

  let out = fillListadoPatientSentinels(xml, patient);
  out = fillListadoMedicoSentinels(out, medicos);

  const { tr1End, stub, medicoRow, tblClose } = locateListadoTable(out);
  const activos = listado.activos || [];
  const inactivos = listado.inactivos || [];
  const { problemTables, numIdAlloc } = buildProblemTables(activos, inactivos, stub, buildProblemRow);
  const tail = problemTables.join('') + `<w:tbl>${stub}${medicoRow}</w:tbl>`;
  out = out.slice(0, tr1End) + '</w:tbl>' + tail + out.slice(tblClose);

  return { xml: out, numIdAlloc };
}

module.exports = {
  fillListadoDocumentXml,
  injectListadoNumbering,
};
