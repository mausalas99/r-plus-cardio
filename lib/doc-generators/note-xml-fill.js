'use strict';

const { esc, replaceT } = require('./shared.js');

const RPR_NORMAL =
  '<w:rPr><w:color w:val="231F20"/><w:spacing w:val="6"/>' +
  '<w:sz w:val="23"/><w:lang w:val="es-ES"/></w:rPr>';

function findParagraphs(xml) {
  const paragraphs = [];
  const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    paragraphs.push(m[0]);
  }
  return paragraphs;
}

function getTx(tratamiento, i) {
  return i < tratamiento.length ? tratamiento[i].toUpperCase() : '';
}

function normalizeLines(raw) {
  if (!raw) return [];
  return String(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.toUpperCase());
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((d) => String(d).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);
  }
  return [];
}

function fillPatientHeader(xml, patient, replaceTBound) {
  const nombre = (patient.nombre || '').toUpperCase();
  const registro = patient.registro || '';
  const edad = String(patient.edad || '');
  const sexo = patient.sexo || '';
  const area = (patient.area || '').toUpperCase();
  const servicio = (patient.servicio || '').toUpperCase();
  const cuarto = patient.cuarto || '';
  const cama = patient.cama || '';

  let out = xml;
  out = out.replace('MARÍA ELVIRA SIFUENTES GARCÍA', esc(nombre));
  out = out.replace('2207709-2', esc(registro));
  out = replaceTBound(out, '77', edad);
  out = out.replace('CIRUGÍA AB', esc(area));
  out = out.replace('MEDICINA INTERNA', esc(servicio));
  out = out.replace('<w:t>F</w:t>', `<w:t>${esc(sexo)}</w:t>`);
  out = replaceTBound(out, '440', cuarto);
  out = out.replace(
    '<w:t xml:space="preserve"> 05</w:t>',
    `<w:t xml:space="preserve"> ${esc(cama)}</w:t>`,
  );
  return out;
}

function fillNoteDateTime(xml, note, replaceTBound) {
  const fecha = note.fecha || '';
  const hora = note.hora || '';
  let out = replaceTBound(xml, '08/04/2026', fecha);
  out = replaceTBound(out, '09:00', hora);
  return out;
}

function fillLineReplacements(xml, lines, origLines, replaceTBound) {
  let out = xml;
  for (let i = 0; i < origLines.length; i += 1) {
    const newVal = i < lines.length ? lines[i] : '';
    out = replaceTBound(out, origLines[i], newVal);
  }
  return out;
}

function stripLabPrefixes(xml) {
  let out = xml;
  for (const prefix of ['QS', 'ESC', 'BH', 'PFHs']) {
    out = out.replace(
      new RegExp(`<w:t(?:\\s[^>]*)?>${prefix}</w:t>\\s*<w:tab/>`, 'g'),
      '<w:t></w:t>',
    );
  }
  return out;
}

function buildDiagnosticos(note) {
  let diagnosticos = normalizeStringList(note.diagnosticos);
  const dx1 = diagnosticos.length > 0 ? diagnosticos[0].toUpperCase() : '';
  let dx2 = diagnosticos.length > 1 ? diagnosticos[1].toUpperCase() : '';
  if (diagnosticos.length > 2) {
    dx2 += ` | ${diagnosticos.slice(2).map((d) => d.toUpperCase()).join(' | ')}`;
  }
  return { dx1, dx2 };
}

function fillVitals(xml, note, replaceTBound) {
  let out = xml;
  out = replaceTBound(out, '130/70', note.ta || '');
  out = replaceTBound(out, '19', note.fr || '');
  out = out.replace(
    '<w:t xml:space="preserve">72  </w:t>',
    `<w:t xml:space="preserve">${esc(note.fc || '')}  </w:t>`,
  );
  out = out.replace(
    '<w:t xml:space="preserve"> 36°C</w:t>',
    `<w:t xml:space="preserve"> ${esc(note.temp || '')}°C</w:t>`,
  );
  out = out.replace(
    '<w:t xml:space="preserve"> 55.000</w:t>',
    `<w:t xml:space="preserve"> ${esc(note.peso || '')}</w:t>`,
  );
  return out;
}

function fillTratamiento(xml, tratamiento, medico, txLeftOrig, txRightOrig, origMedicoSuffix) {
  const paragraphs = findParagraphs(xml);
  if (paragraphs.length <= 68) {
    throw new Error('template.docx: párrafo P68 no encontrado');
  }
  const p68 = paragraphs[68];
  const pprMatch = p68.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const ppr68Str = pprMatch ? pprMatch[0] : '';

  const tx0 = getTx(tratamiento, 0);
  const tx5 = getTx(tratamiento, 5);
  const left1 = tx0 ? `1. ${tx0}` : '1. ___________________________________';
  const right6 = tx5 ? `6. ${tx5}` : '6. ___________________________________';

  const p68New =
    `<w:p><w:pPr>${ppr68Str}</w:pPr>` +
    `<w:r>${RPR_NORMAL}<w:t xml:space="preserve">${esc(left1)}${'  '.repeat(10)}</w:t></w:r>` +
    `<w:r>${RPR_NORMAL}<w:t>${esc(right6)}</w:t></w:r>` +
    '</w:p>';
  let out = xml.replace(p68, p68New);

  for (let i = 0; i < txLeftOrig.length; i += 1) {
    const orig = txLeftOrig[i];
    const tx = getTx(tratamiento, i + 1);
    const newTx = tx ? `${i + 2}. ${tx}` : orig;
    out = out.replace(orig, esc(newTx));
  }

  for (let i = 0; i < txRightOrig.length; i += 1) {
    const orig = txRightOrig[i];
    const num = i + 7;
    const tx = getTx(tratamiento, i + 6);
    const newTx = tx ? `${num}. ${tx}` : orig;
    out = out.replace(orig, esc(newTx));
  }

  const medicoStr = medico || '';
  out = out.replace(
    new RegExp(
      `<w:t>R3</w:t>(\\s*</w:r>\\s*<w:r>.*?)<w:t>${esc(origMedicoSuffix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</w:t>`,
      's',
    ),
    `<w:t></w:t>$1<w:t>${esc(medicoStr)}</w:t>`,
  );
  return out;
}

function fillNoteDocumentXml(xml, patient, note, constants) {
  const replaceTBound = (doc, orig, val) => replaceT(doc, orig, val);
  let out = fillNoteDateTime(xml, note, replaceTBound);
  out = replaceTBound(out, constants.ORIG_INTERR, (note.interrogatorio || '').toUpperCase());
  out = fillPatientHeader(out, patient, replaceTBound);
  out = fillLineReplacements(
    out,
    normalizeLines(note.evolucion),
    constants.ORIG_EVOL_LINES,
    replaceTBound,
  );
  out = fillLineReplacements(
    out,
    normalizeLines(note.estudios),
    constants.ORIG_ESTUDIOS_LINES,
    replaceTBound,
  );
  out = stripLabPrefixes(out);
  const { dx1, dx2 } = buildDiagnosticos(note);
  out = replaceTBound(out, 'CONTROL METABÓLICO', dx1);
  out = replaceTBound(out, 'ABSCESO HEPÁTICO EN LÓBULO HEPÁTICO IZQUIERDO', dx2);
  out = fillVitals(out, note, replaceTBound);
  const tratamiento = normalizeStringList(note.tratamiento);
  out = fillTratamiento(
    out,
    tratamiento,
    note.medico || '',
    constants.TX_LEFT_ORIG,
    constants.TX_RIGHT_ORIG,
    constants.ORIG_MEDICO_SUFFIX,
  );
  out = replaceTBound(out, 'DRA. MÓNICA SANCHEZ', note.profesor || '');
  out = out.replace(
    '<w:t xml:space="preserve"> _____</w:t>',
    '<w:t xml:space="preserve"> </w:t>',
  );
  return out;
}

module.exports = {
  fillNoteDocumentXml,
  normalizeLines,
  normalizeStringList,
};
