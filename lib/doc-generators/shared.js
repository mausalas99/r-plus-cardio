'use strict';
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');

function esc(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceT(xml, oldVal, newVal) {
  const eOld = esc(oldVal);
  const eNew = esc(newVal);
  let out = xml.split(`<w:t>${eOld}</w:t>`).join(`<w:t>${eNew}</w:t>`);
  out = out
    .split(`<w:t xml:space="preserve">${eOld}</w:t>`)
    .join(`<w:t xml:space="preserve">${eNew}</w:t>`);
  return out;
}

function resolveGeneratorBaseDir() {
  const dir = path.join(__dirname, '..', '..');
  if (dir.includes('app.asar')) {
    return dir.replace('app.asar', 'app.asar.unpacked');
  }
  return dir;
}

function resolveTemplatePath(fileName) {
  const base = resolveGeneratorBaseDir();
  const p = path.join(base, fileName);
  if (!fs.existsSync(p)) throw new Error(`Plantilla no encontrada: ${fileName}`);
  return p;
}

async function loadDocxTemplate(templateFileName) {
  const templatePath = resolveTemplatePath(templateFileName);
  const data = await fs.promises.readFile(templatePath);
  const zip = await JSZip.loadAsync(data);
  const files = {};
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  for (const name of names) {
    files[name] = await zip.files[name].async('nodebuffer');
  }
  return { names, files };
}

async function packDocxBuffer(files, names) {
  const zip = new JSZip();
  for (const name of names) {
    zip.file(name, files[name]);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
  esc,
  replaceT,
  resolveGeneratorBaseDir,
  resolveTemplatePath,
  loadDocxTemplate,
  packDocxBuffer,
};
