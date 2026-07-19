'use strict';

const { loadDocxTemplate, packDocxBuffer } = require('./shared.js');
const {
  fillIndicacionesTable,
  fillIndicacionesPatientFields,
} = require('./indicaciones-table-fill.js');
const {
  cellR0c0,
  cellR0c1,
  sectionXml,
} = require('./indicaciones-cells.js');

const ORIG_NOMBRE = ' MA BEATRIZ LOREDO RODRÍGUEZ';
const ORIG_REGISTRO = '2141273-5';
const ORIG_EDAD = '68';
const ORIG_SEXO = 'F';
const ORIG_AREA = 'TRAUMATOLOGIA';
const ORIG_SERVICIO = 'MEDICINA INTERNA';
const ORIG_CUARTO = '419';
const ORIG_CAMA = ' 1';

async function generateIndicacionesBuffer({ patient, indicaciones }) {
  patient = patient || {};
  indicaciones = indicaciones || {};

  const { names, files } = await loadDocxTemplate('template_indicaciones.docx');
  const servicio = (patient.servicio || 'MEDICINA INTERNA').toUpperCase();

  let xml = files['word/document.xml'].toString('utf-8');
  xml = fillIndicacionesTable(xml, indicaciones, servicio);
  xml = fillIndicacionesPatientFields(xml, patient, servicio, {
    ORIG_NOMBRE,
    ORIG_REGISTRO,
    ORIG_EDAD,
    ORIG_SEXO,
    ORIG_AREA,
    ORIG_SERVICIO,
    ORIG_CUARTO,
    ORIG_CAMA,
  });

  files['word/document.xml'] = Buffer.from(xml, 'utf-8');
  return packDocxBuffer(files, names);
}

module.exports = {
  generateIndicacionesBuffer,
  cellR0c0,
  cellR0c1,
  sectionXml,
  ORIG_NOMBRE,
};
