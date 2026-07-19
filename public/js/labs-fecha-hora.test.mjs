import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLabReportFechaDMY, extractLabReportHora, procesarLabs } from './labs.js';

const HEADER_MAY_AM = `
Expediente:	1929604-8	Solicitud:	2605180169
Nombre:	RAUL CORONADO PALOMO	Fecha Registro:	May 18 2026 3:24AM
Sexo:	MASCULINO	Ubicación:	NEUROMEDICA
Edad:	70	Medico:	A QUIEN CORRESPONDA
`;

const HEADER_NUM_PM = `
Nombre:	CORONADO PALOMO RAUL	Fecha Registro:	07/05/2026 04:32:46 p. m.
`;

test('extractLabReportFechaDMY parsea May 18 2026', () => {
  assert.equal(extractLabReportFechaDMY(HEADER_MAY_AM), '18/05/2026');
});

test('extractLabReportHora parsea 3:24AM como 03:24', () => {
  assert.equal(extractLabReportHora(HEADER_MAY_AM), '03:24');
});

test('extractLabReportHora parsea p. m. en formato numérico', () => {
  assert.equal(extractLabReportHora(HEADER_NUM_PM), '16:32');
});

test('procesarLabs expone fecha y hora del reporte en patient', () => {
  const r = procesarLabs(HEADER_MAY_AM + '\nHEMATOLOGIA\n');
  assert.equal(r.patient.fecha, '18/05/2026');
  assert.equal(r.patient.hora, '03:24');
});
