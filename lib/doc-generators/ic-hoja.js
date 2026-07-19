'use strict';

const { loadDocxTemplate, packDocxBuffer } = require('./shared.js');
const { fillIcHojaXml } = require('./ic-hoja-xml-fill.js');

const IC_TEMPLATE = 'templates/ic-seguimiento.docx';

/**
 * Fill the institutional IC seguimiento template from an export payload.
 * Section order is preserved (sentinel string replace only).
 *
 * @param {{ payload: Record<string, unknown> }} opts
 * @returns {Promise<Buffer>}
 */
async function generateIcHojaBuffer({ payload }) {
  const { names, files } = await loadDocxTemplate(IC_TEMPLATE);
  const xml = fillIcHojaXml(files['word/document.xml'].toString('utf-8'), payload || {});
  files['word/document.xml'] = Buffer.from(xml, 'utf-8');
  return packDocxBuffer(files, names);
}

module.exports = {
  generateIcHojaBuffer,
  IC_TEMPLATE,
};
