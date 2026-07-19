import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeSomeLabReport } from './labs.js';
import { looksLikeSomeMedicationPaste } from './med-receta-core.mjs';

const LAB_HEADER = `
Expediente:	1929604-8	Solicitud:	2605180169
Nombre:	RAUL CORONADO PALOMO	Fecha Registro:	May 18 2026 3:24AM
HEMATOLOGIA
`;

const MED_LINE =
  '02/05/2026 08:31:38 a.m.\tMEDICAMENTOS\tMETRONIDAZOL 500 MG\tVIA INTRAVENOSA\t500 MG // *DIA# 3*\tCADA 8 HORAS\tNW';

test('looksLikeSomeLabReport true con encabezado SOME', () => {
  assert.equal(looksLikeSomeLabReport(LAB_HEADER), true);
});

test('looksLikeSomeLabReport false sin Expediente', () => {
  assert.equal(looksLikeSomeLabReport('BH\tHb 12.1'), false);
});

test('looksLikeSomeMedicationPaste true con fila MEDICAMENTOS tabulada', () => {
  assert.equal(looksLikeSomeMedicationPaste(MED_LINE), true);
});

test('looksLikeSomeMedicationPaste false sin tabuladores', () => {
  assert.equal(looksLikeSomeMedicationPaste('METRONIDAZOL 500 MG'), false);
});
