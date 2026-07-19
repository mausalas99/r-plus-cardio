/**
 * Rellena la plantilla AcroForm HU 000-061-R-06-12 (receta médica).
 * Campos mapeados por inspección del PDF oficial.
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const TEMPLATE_NAME = 'receta-hu-000-061-R-06-12.pdf';

/** @typedef {{ medicamento?: string, presentacion?: string, dosis?: string }} RecetaHuMedRow */

function resolveTemplatePath(baseDir) {
  const roots = [
    baseDir,
    baseDir && baseDir.includes('app.asar') ? baseDir.replace('app.asar', 'app.asar.unpacked') : null,
  ].filter(Boolean);
  for (const root of roots) {
    const p = path.join(root, 'templates', TEMPLATE_NAME);
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch (_e) { /* ignored */ }
  }
  throw new Error('No se encontró la plantilla PDF de receta HU.');
}

function setTextSafe(form, name, value) {
  try {
    form.getTextField(name).setText(String(value || ''));
  } catch (_e) {
    // Campo ausente en variantes de plantilla — ignorar.
  }
}

function splitToFieldLines(text, maxLines) {
  const raw = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const lines = [];
  for (const line of raw) {
    if (lines.length >= maxLines) {
      const last = lines.length - 1;
      lines[last] = (lines[last] + ' ' + line).trim();
      continue;
    }
    lines.push(line);
  }
  while (lines.length < maxLines) lines.push('');
  return lines.slice(0, maxLines);
}

/**
 * @param {RecetaHuMedRow[]} meds
 */
function formatMedicationsBlock(meds) {
  const rows = Array.isArray(meds) ? meds : [];
  const lines = rows
    .map(function (row) {
      const m = String(row && row.medicamento ? row.medicamento : '').trim();
      const p = String(row && row.presentacion ? row.presentacion : '').trim();
      const d = String(row && row.dosis ? row.dosis : '').trim();
      if (!m && !p && !d) return '';
      return [m, p, d].filter(Boolean).join('  ·  ');
    })
    .filter(Boolean);
  return lines.join('\n');
}

/**
 * @param {string[]} labs
 */
function formatLabList(labs) {
  return (Array.isArray(labs) ? labs : [])
    .map(function (x) {
      return String(x || '').trim();
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {{
 *   patient: { nombre?: string, registro?: string, servicio?: string },
 *   fecha?: string,
 *   meds?: RecetaHuMedRow[],
 *   labs?: string[],
 *   cuidados?: string,
 *   proximaCita?: string,
 *   proximaCitaFecha?: string,
 *   doctorName?: string,
 *   cedulaProfesional?: string,
 * }} payload
 * @param {string} baseDir
 */
async function fillRecetaHuPdf(payload, baseDir) {
  const templatePath = resolveTemplatePath(baseDir || __dirname);
  const pdf = await PDFDocument.load(fs.readFileSync(templatePath));
  const form = pdf.getForm();

  const patient = (payload && payload.patient) || {};
  setTextSafe(form, 'Text47', patient.nombre);
  setTextSafe(form, 'Text48', patient.registro);
  setTextSafe(form, 'Text49', patient.servicio);
  setTextSafe(form, 'Text50', payload.fecha);
  setTextSafe(form, 'Text51', formatMedicationsBlock(payload.meds));
  setTextSafe(form, 'Text52', formatLabList(payload.labs));
  setTextSafe(form, 'Text53', payload.doctorName);
  setTextSafe(form, 'Text54', payload.cedulaProfesional);

  const cuidadosLines = splitToFieldLines(payload.cuidados, 16);
  for (let i = 0; i < 8; i++) {
    setTextSafe(form, 'Text55.' + i, cuidadosLines[i] || '');
  }
  for (let j = 0; j < 8; j++) {
    setTextSafe(form, 'Text56.' + j, cuidadosLines[8 + j] || '');
  }

  setTextSafe(form, 'Text57', payload.proximaCita);
  setTextSafe(form, 'Text58', payload.proximaCitaFecha);

  // Sin flatten: firma a mano en impresión.
  return Buffer.from(await pdf.save());
}

module.exports = {
  fillRecetaHuPdf,
  formatMedicationsBlock,
  formatLabList,
  splitToFieldLines,
};
