import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitDocumentSections } from './segment.mjs';

test('splitDocumentSections finds EVENTUALIDADES and excludes ESTADO ACTUAL body', () => {
  const text = [
    'EVENTUALIDADES',
    '01/06',
    'NOTA DEL DIA',
    'ESTADO ACTUAL',
    'N: ALERTA',
    '01/06',
    'OTRA NOTA',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.ok(s.eventualidadesBlocks.length >= 1);
  const evText = s.eventualidadesBlocks.join('\n');
  assert.match(evText, /OTRA NOTA/);
  assert.doesNotMatch(evText, /N: ALERTA/);
});

test('splitDocumentSections keeps EVENTUALIDADES before ESTADO ACTUAL con fecha', () => {
  const text = [
    'EVENTUALIDADES',
    '02/06',
    'HOY PASA A HEMODIALISIS',
    '01/06/2026',
    '-EL DIA DE HOY SE COMENTA',
    'ESTADO ACTUAL 01.06.2026',
    'N: FOUR 16',
    'LABORATORIOS',
    '02/06',
    'BH Hb 8.95*',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.equal(s.eventualidadesBlocks.length, 1);
  assert.match(s.eventualidadesBlocks[0], /HEMODIALISIS/);
  assert.match(s.eventualidadesBlocks[0], /SE COMENTA/);
  assert.doesNotMatch(s.eventualidadesBlocks[0], /FOUR 16/);
  assert.match(s.sections.laboratorios || '', /BH Hb/);
});

test('splitDocumentSections merges two EVENTUALIDADES blocks', () => {
  const text = [
    'EVENTUALIDADES EN ESTE INTERNAMIENTO',
    '23/05',
    'NOTA CORTA',
    'EVENTUALIDADES',
    '22/05',
    'NOTA LARGA',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.equal(s.eventualidadesBlocks.length, 2);
});

test('splitDocumentSections captures HISTORIA CLINICA section', () => {
  const text = ['DX:', '1. DM2', 'HISTORIA CLÍNICA', 'ORIGEN: MTY', 'PEEA', 'NARRATIVA'].join('\n');
  const s = splitDocumentSections(text);
  assert.match(s.sections.historiaClinica || '', /ORIGEN/);
  assert.match(s.sections.peea || '', /NARRATIVA/);
});

test('splitDocumentSections accepts section headers with trailing colon', () => {
  const text = [
    '206-2 | PACIENTE | 71 AÑOS | 2161195-6 | MELENA',
    'PENDIENTES:',
    'ENDOSCOPIA HOY',
    'HISTORIA CLÍNICA:',
    'FIUX: 31/05/2026',
    'MOTIVO DE CONSULTA: MELENA',
    'FICHA DE IDENTIFICACIÓN:',
    'NOMBRE: PACIENTE',
    'ANTECEDENTES HEREDOFAMILIARES:',
    'MADRE: FINADA',
    'PRINCIPIO EVOLUCIÓN Y ESTADO ACTUAL:',
    'NARRATIVA LARGA',
    'EVENTUALIDADES',
    '02/06',
    'NOTA',
    'LABORATORIOS:',
    '02/06',
    'BH Hb 10.1',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.equal(s.headerLines.length, 1);
  assert.match(s.headerLines[0], /^206-2 \|/);
  assert.match(s.sections.pendientes || '', /ENDOSCOPIA/);
  assert.match(s.sections.historiaClinica || '', /FIUX/);
  assert.match(s.sections.ficha || '', /NOMBRE/);
  assert.match(s.sections.peea || '', /NARRATIVA/);
  assert.match(s.sections.laboratorios || '', /BH Hb/);
  assert.equal(s.eventualidadesBlocks.length, 1);
});

test('splitDocumentSections handles abbreviated AHF/APNP/APP headers', () => {
  const text = [
    '433-5 || PACIENTE || 48 || 2216164-3 || DX',
    'AHF',
    'MADRE: VIVA',
    'APNP',
    'TABAQUISMO: NEGADO',
    'APP',
    'DIABETES MELLITUS',
    'PEEA',
    'NARRATIVA',
    'EVENTUALIDADES',
    '02/06',
    'NOTA',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.match(s.sections.ahf || '', /MADRE/);
  assert.match(s.sections.apnp || '', /TABAQUISMO/);
  assert.match(s.sections.app || '', /DIABETES/);
});

test('splitDocumentSections captures IDX and LABORATORIOS DE INGRESO', () => {
  const text = [
    'PACIENTE | 27 | 123-4 | DX',
    'IDX:',
    'DIABETES',
    'FICHA DE IDENTIFICACIÓN',
    'NOMBRE: PACIENTE',
    'EVENTUALIDADES',
    '01/06',
    'NOTA',
    'LABORATORIOS DE INGRESO',
    '23/05/26',
    'Hb 7.14',
    'LABORATORIOS',
    '02/06',
    'Hb 8.55',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.match(s.sections.dx || '', /DIABETES/);
  assert.match(s.sections.laboratorios || '', /Hb 7\.14/);
  assert.match(s.sections.laboratorios || '', /Hb 8\.55/);
});

test('splitDocumentSections stops PEEA before IPAS and cateteres', () => {
  const text = [
    'ANTECEDENTES PERSONALES PATOLÓGICOS:',
    'ENFERMEDADES:',
    'DIABETES',
    'PRINCIPIO EVOLUCIÓN Y ESTADO ACTUAL:',
    'NARRATIVA PEEA',
    'IPAS (DATOS NEGATIVOS RELEVANTES)',
    'CATÉTERES Y SONDAS:',
    'CVC: DIA/MES',
    'ESTADO ACTUAL',
    'N: FOUR',
    'EVENTUALIDADES',
    '02/06',
    'NOTA',
  ].join('\n');
  const s = splitDocumentSections(text);
  assert.match(s.sections.peea || '', /NARRATIVA PEEA/);
  assert.doesNotMatch(s.sections.peea || '', /CATÉTERES/);
  assert.match(s.sections.cateteres || '', /CVC/);
});
