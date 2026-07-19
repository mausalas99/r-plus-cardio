import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDriveDocument } from './parse-drive-document.mjs';

const FICHA_SAMPLE = [
  '214-4 | VÍCTOR IRACHETA TORRES | 64 AÑOS | 1123383-2 | CHOQUE SÉPTICO',
  'INTERROGATORIO',
  'HISTORIA CLÍNICA',
  'FICHA DE IDENTIFICACIÓN',
  'NOMBRE: VÍCTOR IRACHETA TORRES',
  'SEXO: MASCULINO',
  'ORIGEN: DOCTOR ARROYO',
  'ANTECEDENTES HEREDOFAMILIARES',
  'MADRE: FINADA',
  'ANTECEDENTES PERSONALES NO PATOLÓGICOS',
  'TABAQUISMO: POSITIVO',
  'ANTECEDENTES PERSONALES PATOLÓGICOS',
  'DIABETES MELLITUS TIPO 2',
  'PADECIMIENTO ACTUAL / PEEA',
  'PACIENTE MASCULINO DE 64 AÑOS CON FIEBRE',
  'EVENTUALIDADES EN ESTE INTERNAMIENTO',
  '23/05',
  'SE SUSPENDE PLAN DE LIQUIDOS',
  'EVENTUALIDADES',
  '22/05',
  'SE PASA 250 ML DE HARTMANN',
].join('\n');

test('parseDriveDocument universal ficha + eventualidades', () => {
  const r = parseDriveDocument(FICHA_SAMPLE);
  assert.equal(r.header.registro, '1123383-2');
  assert.ok(r.eventualidades.entries.length >= 2);
  assert.ok(r.hcPatch.padecimientoActual);
  assert.match(r.previewText, /Vista previa/);
});

test('parseDriveDocument universal pipe HC', () => {
  const text = [
    '215-4| ANDRÉS GARCÍA | 29 AÑOS | 2109946-3 | ANASARCA',
    'MOTIVO DE CONSULTA: DOLOR',
    'HISTORIA CLÍNICA',
    'ORIGEN: MONTERREY',
    'PEEA',
    'NARRATIVA LARGA',
    'EVENTUALIDADES',
    '1/06',
    'NOTA',
  ].join('\n');
  const r = parseDriveDocument(text);
  assert.match(r.hcPatch.motivoConsulta || '', /DOLOR/);
  assert.match(r.previewText, /Eventualidades/);
});

test('fragment text as eventualidades when no HC headers', () => {
  const text = ['02/06', 'LINEA UNO', '01/06/2026', 'LINEA DOS'].join('\n');
  const r = parseDriveDocument(text);
  assert.equal(Object.keys(r.hcPatch).length, 0);
  assert.equal(r.eventualidades.entries.length, 2);
});

test('parseDriveDocument imports laboratorios section', () => {
  const text = [
    '215-4| PACIENTE | 40 AÑOS | 123-1 | DX',
    'LABORATORIOS',
    '02/06',
    'BH Hb 8.95* Hto 29.5* Leu 15.1* Plt 340',
    'QS Glu 77 Cr 6.4*',
    'EVENTUALIDADES',
    '02/06',
    'NOTA',
  ].join('\n');
  const r = parseDriveDocument(text);
  assert.equal(r.laboratorios.sets.length, 1);
  assert.equal(r.laboratorios.sets[0].fecha, '02/06/2026');
  assert.equal(r.laboratorios.sets[0].resLabs.length, 2);
});
