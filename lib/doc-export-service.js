'use strict';

const path = require('path');
const { generateNoteBuffer } = require('./doc-generators/note.js');
const { generateIndicacionesBuffer } = require('./doc-generators/indicaciones.js');
const { generateListadoBuffer } = require('./doc-generators/listado.js');
const { generateIcHojaBuffer } = require('./doc-generators/ic-hoja.js');
const { renderCensusPdf } = require('../generate-censo.js');
const { fillRecetaHuPdf } = require('../generate-receta-hu.js');
const { resolveAllowedOutputDir } = require('./output-dir-policy.js');

function safeName(str) {
  return (str || '').replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, '_');
}

function getScriptsDir() {
  const root = path.join(__dirname, '..');
  return root.includes('app.asar') ? root.replace('app.asar', 'app.asar.unpacked') : root;
}

function badRequest(message) {
  const err = new Error(message);
  err.code = 'BAD_REQUEST';
  return err;
}

function resolveExportDir(outputDir, paths) {
  try {
    return resolveAllowedOutputDir(outputDir, paths);
  } catch (e) {
    if (e && e.code === 'OUTPUT_DIR_NOT_ALLOWED') {
      const err = new Error('La carpeta de exportación no está autorizada. Configúrala en Mi Perfil.');
      err.code = 'OUTPUT_DIR_NOT_ALLOWED';
      throw err;
    }
    if (e && e.code === 'OUTPUT_DIR_NOT_WRITABLE') {
      const err = new Error('No se puede escribir en la carpeta seleccionada.');
      err.code = 'OUTPUT_DIR_NOT_WRITABLE';
      throw err;
    }
    throw e;
  }
}

async function exportNoteDocx({ patient, note }) {
  if (!patient || !note) throw badRequest('Missing patient or note');
  const buf = await generateNoteBuffer({ patient, note });
  const fileName = `Nota_Evolucion_${safeName(patient.nombre)}_${safeName(note.fecha || '')}.docx`;
  return { buffer: buf, fileName };
}

async function exportIndicacionesDocx({ patient, indicaciones }) {
  if (!patient || !indicaciones) throw badRequest('Missing patient or indicaciones');
  const buf = await generateIndicacionesBuffer({ patient, indicaciones });
  const fileName = `Indicaciones_${safeName(patient.nombre)}_${safeName(indicaciones.fecha || '')}.docx`;
  return { buffer: buf, fileName };
}

async function exportListadoDocx({ patient, listado, medicos }) {
  if (!patient || !listado) throw badRequest('Missing patient or listado');
  const buf = await generateListadoBuffer({
    patient,
    listado,
    medicos: medicos || {},
  });
  const now = new Date();
  const stamp = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('-');
  const fileName = `Listado_Problemas_${safeName(patient.nombre)}_${safeName(listado.fecha || '')}_${stamp}.docx`;
  return { buffer: buf, fileName };
}

async function exportIcHojaDocx({ patient, asOfDate }) {
  if (!patient) throw badRequest('Missing patient');
  const { buildIcExportPayload } = await import('./cardio/ic-export-payload.mjs');
  const payload = buildIcExportPayload(patient, { asOfDate });
  const buf = await generateIcHojaBuffer({ payload });
  const fileName = `Hoja_IC_${safeName(patient.nombre)}_${safeName(payload.asOfDate || asOfDate || '')}.docx`;
  return { buffer: buf, fileName };
}

async function exportCensoPdf({ header, rows, servicio }) {
  if (!Array.isArray(rows) || !rows.length) throw badRequest('No hay pacientes para el censo.');
  const { censoFileName } = await import('./censo-export-file.mjs');
  const buf = await renderCensusPdf({ header: header || {}, rows });
  const now = new Date();
  const fileName = censoFileName(servicio || (header && header.servicio) || 'guardia', now);
  return { buffer: buf, fileName };
}

async function exportRecetaHuPdf({ patient, receta, doctorName, cedulaProfesional }) {
  if (!patient) throw badRequest('Missing patient');
  const payload = Object.assign({}, receta || {}, {
    patient,
    doctorName: doctorName || '',
    cedulaProfesional: cedulaProfesional || '',
  });
  const buffer = await fillRecetaHuPdf(payload, getScriptsDir());
  const fileName = `Receta_HU_${safeName(patient.nombre)}_${safeName(receta && receta.fecha ? receta.fecha : '')}.pdf`;
  return { buffer, fileName };
}

module.exports = {
  safeName,
  resolveExportDir,
  exportNoteDocx,
  exportIndicacionesDocx,
  exportListadoDocx,
  exportIcHojaDocx,
  exportCensoPdf,
  exportRecetaHuPdf,
};
