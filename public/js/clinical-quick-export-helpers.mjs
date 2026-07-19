import { escHtml } from './dom-escape.mjs';
export { escHtml };
export function toLines(value) {
  if (Array.isArray(value)) {
    return value.map(function (v) {
      return String(v || '').trim();
    }).filter(Boolean);
  }
  return String(value || '')
    .split('\n')
    .map(function (v) {
      return v.trim();
    })
    .filter(Boolean);
}

function pushTextBlock(blocks, label, value) {
  blocks.push(label + ':');
  var lines = toLines(value);
  if (!lines.length) blocks.push('(sin contenido)');
  lines.forEach(function (l) {
    blocks.push('- ' + l);
  });
}

function appendPatientHeader(blocks, patient) {
  blocks.push('R+ - SALIDA CLINICA');
  blocks.push('PACIENTE: ' + (patient.nombre || ''));
  blocks.push('REGISTRO: ' + (patient.registro || ''));
  blocks.push('SERVICIO: ' + (patient.servicio || ''));
  blocks.push('CUARTO/CAMA: ' + (patient.cuarto || '') + '/' + (patient.cama || ''));
  blocks.push('');
}

function appendNoteTextSection(blocks, note) {
  blocks.push('== NOTA DE EVOLUCION ==');
  blocks.push('FECHA/HORA: ' + (note.fecha || '') + ' ' + (note.hora || ''));
  blocks.push('DIAGNOSTICOS:');
  toLines(note.diagnosticos || []).forEach(function (v, idx) {
    blocks.push(idx + 1 + '. ' + v);
  });
  if (!toLines(note.diagnosticos || []).length) blocks.push('(sin contenido)');
  pushTextBlock(blocks, 'INTERROGATORIO', note.interrogatorio);
  pushTextBlock(blocks, 'EXPLORACION FISICA', note.exploracion);
  pushTextBlock(blocks, 'ESTUDIOS', note.estudios);
  pushTextBlock(blocks, 'ANALISIS', note.analisis);
  pushTextBlock(blocks, 'PLAN', note.plan);
  blocks.push(
    'SIGNOS VITALES: TA ' +
      (note.ta || '-') +
      ' | FR ' +
      (note.fr || '-') +
      ' | FC ' +
      (note.fc || '-') +
      ' | TEMP ' +
      (note.temp || '-') +
      ' | PESO ' +
      (note.peso || '-')
  );
  pushTextBlock(blocks, 'TRATAMIENTO E INDICACIONES', note.tratamiento || []);
  blocks.push('MEDICO TRATANTE: ' + (note.medico || ''));
  blocks.push('PROFESOR RESPONSABLE: ' + (note.profesor || ''));
}

function appendIndicacionesTextSection(blocks, ind) {
  blocks.push('== INDICACIONES ==');
  blocks.push('FECHA/HORA: ' + (ind.fecha || '') + ' ' + (ind.hora || ''));
  pushTextBlock(blocks, 'MEDICOS', ind.medicos);
  pushTextBlock(blocks, 'DIETA', ind.dieta);
  pushTextBlock(blocks, 'CUIDADOS', ind.cuidados);
  pushTextBlock(blocks, 'ESTUDIOS', ind.estudios);
  pushTextBlock(blocks, 'MEDICAMENTOS', ind.medicamentos);
  pushTextBlock(blocks, 'INTERCONSULTAS', ind.interconsultas);
  var otros = Array.isArray(ind.otros) ? ind.otros : [];
  if (otros.length) {
    blocks.push('OTROS:');
    otros.forEach(function (item, idx) {
      if (!item || typeof item !== 'object') return;
      blocks.push(idx + 1 + '. ' + (item.titulo || 'Seccion sin titulo'));
      toLines(item.contenido || '').forEach(function (line) {
        blocks.push('   - ' + line);
      });
    });
  }
}

export function buildClinicalTextExport(bundle) {
  var patient = bundle.patient || {};
  var note = bundle.note || {};
  var ind = bundle.indicacion || {};
  var mode = bundle.mode || 'both';
  var blocks = [];
  appendPatientHeader(blocks, patient);
  if (mode !== 'indica') appendNoteTextSection(blocks, note);
  if (mode === 'both') blocks.push('');
  if (mode !== 'note') appendIndicacionesTextSection(blocks, ind);
  return blocks.join('\n');
}

function renderHtmlList(values) {
  var lines = toLines(values);
  if (!lines.length) return '<p><em>Sin contenido</em></p>';
  return (
    '<ul>' +
    lines
      .map(function (line) {
        return '<li>' + escHtml(line) + '</li>';
      })
      .join('') +
    '</ul>'
  );
}

function renderHtmlOtherSections(otros) {
  if (!otros.length) return '<p><em>Sin secciones adicionales</em></p>';
  return otros
    .filter(function (item) {
      return item && typeof item === 'object';
    })
    .map(function (item) {
      return (
        '<article><h4>' +
        escHtml(item.titulo || 'Seccion sin titulo') +
        '</h4>' +
        renderHtmlList(item.contenido || '') +
        '</article>'
      );
    })
    .join('');
}

function buildNoteHtmlSection(note) {
  return (
    '<section><h2>Nota de evolucion</h2>' +
    '<p><strong>Fecha/Hora:</strong> ' +
    escHtml(note.fecha || '') +
    ' ' +
    escHtml(note.hora || '') +
    '</p>' +
    '<h3>Diagnosticos</h3>' +
    renderHtmlList(note.diagnosticos || []) +
    '<h3>Interrogatorio</h3>' +
    renderHtmlList(note.interrogatorio) +
    '<h3>Exploracion fisica</h3>' +
    renderHtmlList(note.exploracion) +
    '<h3>Estudios</h3>' +
    renderHtmlList(note.estudios) +
    '<h3>Analisis</h3>' +
    renderHtmlList(note.analisis) +
    '<h3>Plan</h3>' +
    renderHtmlList(note.plan) +
    '<h3>Signos vitales</h3><p>TA ' +
    escHtml(note.ta || '-') +
    ' | FR ' +
    escHtml(note.fr || '-') +
    ' | FC ' +
    escHtml(note.fc || '-') +
    ' | TEMP ' +
    escHtml(note.temp || '-') +
    ' | PESO ' +
    escHtml(note.peso || '-') +
    '</p>' +
    '<h3>Tratamiento e indicaciones medicas</h3>' +
    renderHtmlList(note.tratamiento || []) +
    '</section>'
  );
}

function buildIndicaHtmlSection(ind) {
  return (
    '<section><h2>Indicaciones</h2>' +
    '<p><strong>Fecha/Hora:</strong> ' +
    escHtml(ind.fecha || '') +
    ' ' +
    escHtml(ind.hora || '') +
    '</p>' +
    '<h3>Medicos</h3>' +
    renderHtmlList(ind.medicos) +
    '<h3>Dieta</h3>' +
    renderHtmlList(ind.dieta) +
    '<h3>Cuidados</h3>' +
    renderHtmlList(ind.cuidados) +
    '<h3>Estudios</h3>' +
    renderHtmlList(ind.estudios) +
    '<h3>Medicamentos</h3>' +
    renderHtmlList(ind.medicamentos) +
    '<h3>Interconsultas</h3>' +
    renderHtmlList(ind.interconsultas) +
    '<h3>Otros</h3>' +
    renderHtmlOtherSections(Array.isArray(ind.otros) ? ind.otros : []) +
    '</section>'
  );
}

export function buildClinicalHtmlExport(bundle) {
  var patient = bundle.patient || {};
  var note = bundle.note || {};
  var ind = bundle.indicacion || {};
  var mode = bundle.mode || 'both';
  var noteHtml = buildNoteHtmlSection(note);
  var indicaHtml = buildIndicaHtmlSection(ind);
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:;">' +
    '<title>R+ salida clinica</title>' +
    '<style>body{font-family:Arial,sans-serif;line-height:1.45;margin:24px;color:#111}h1,h2{margin-bottom:8px}section{margin:20px 0;padding-top:8px;border-top:1px solid #ddd}h3{margin:14px 0 6px}ul{margin:0 0 8px 20px}p{margin:0 0 8px}</style>' +
    '</head><body>' +
    '<h1>R+ - Salida clinica</h1>' +
    '<p><strong>Paciente:</strong> ' +
    escHtml(patient.nombre || '') +
    ' | <strong>Registro:</strong> ' +
    escHtml(patient.registro || '') +
    '</p>' +
    '<p><strong>Servicio:</strong> ' +
    escHtml(patient.servicio || '') +
    ' | <strong>Cuarto/Cama:</strong> ' +
    escHtml(patient.cuarto || '') +
    '/' +
    escHtml(patient.cama || '') +
    '</p>' +
    (mode !== 'indica' ? noteHtml : '') +
    (mode !== 'note' ? indicaHtml : '') +
    '</body></html>'
  );
}
