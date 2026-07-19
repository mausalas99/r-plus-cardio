'use strict';

const { replaceT } = require('./shared.js');
const { cellR0c0, cellR0c1, cellR1c0, cellR1c1 } = require('./indicaciones-cells.js');

function findFirstTable(xml) {
  const start = xml.indexOf('<w:tbl>');
  if (start === -1) return null;
  const end = xml.indexOf('</w:tbl>', start);
  if (end === -1) return null;
  return { tblXml: xml.slice(start, end + '</w:tbl>'.length), start, end: end + '</w:tbl>'.length };
}

function findRows(tblXml) {
  const rows = [];
  const re = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let m;
  while ((m = re.exec(tblXml)) !== null) {
    rows.push(m[0]);
  }
  return rows;
}

function findCells(rowXml) {
  const cells = [];
  const re = /<w:tc>[\s\S]*?<\/w:tc>/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) {
    cells.push(m[0]);
  }
  return cells;
}

function fillIndicacionesTable(xml, indicaciones, servicio) {
  const tbl = findFirstTable(xml);
  if (!tbl) {
    throw new Error('template_indicaciones.docx: tabla principal no encontrada');
  }

  const rows = findRows(tbl.tblXml);
  if (rows.length < 2) {
    throw new Error('template_indicaciones.docx: se esperaban al menos 2 filas');
  }

  const cellsR0 = findCells(rows[0]);
  const cellsR1 = findCells(rows[1]);
  if (cellsR0.length < 2 || cellsR1.length < 2) {
    throw new Error('template_indicaciones.docx: celdas incompletas');
  }

  const fecha = (indicaciones.fecha || '').replace(/\//g, '-');
  const hora = indicaciones.hora || '';
  const medicos = indicaciones.medicos || '';
  const otros = indicaciones.otros || [];

  let out = xml;
  out = out.replace(cellsR0[0], cellR0c0(fecha, hora));
  out = out.replace(cellsR0[1], cellR0c1(servicio));
  out = out.replace(cellsR1[0], cellR1c0(medicos));
  out = out.replace(cellsR1[1], cellR1c1(indicaciones, servicio, otros));
  return out;
}

function fillIndicacionesPatientFields(xml, patient, servicio, constants) {
  const nombre = (patient.nombre || '').toUpperCase();
  const registro = patient.registro || '';
  const edad = String(patient.edad || '');
  const sexo = (patient.sexo || '').toUpperCase();
  const area = (patient.area || '').toUpperCase();
  const cuarto = patient.cuarto || '';
  const cama = patient.cama || '';

  let out = xml;
  out = replaceT(out, constants.ORIG_NOMBRE, ` ${nombre}`);
  out = replaceT(out, constants.ORIG_REGISTRO, registro);
  out = replaceT(out, constants.ORIG_EDAD, edad);
  out = replaceT(out, constants.ORIG_SEXO, sexo);
  out = replaceT(out, constants.ORIG_AREA, area);
  out = replaceT(out, constants.ORIG_SERVICIO, servicio);
  out = replaceT(out, constants.ORIG_CUARTO, cuarto);
  out = replaceT(out, constants.ORIG_CAMA, ` ${cama}`);
  return out;
}

module.exports = {
  fillIndicacionesTable,
  fillIndicacionesPatientFields,
};
