import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProximaCitaText,
  buildRecetaHuGeneratePayload,
  formatProximasCitasForPdf,
  normalizeRecetaHuConsultServices,
  normalizeRecetaHuDraft,
} from './receta-hu-core.mjs';

test('normalizeRecetaHuDraft conserva filas de medicamento y labs', () => {
  const d = normalizeRecetaHuDraft({
    fecha: '25/05/2026',
    meds: [{ medicamento: 'Paracetamol', presentacion: 'tab', dosis: '500 mg VO c/8h' }],
    labs: ['Biometría hemática', ''],
    cuidados: 'Dieta blanda',
    proximaCita: 'Acudir en 2 semanas a consulta de Nefrología',
    proximaCitaFecha: '10/06/2026',
  });
  assert.equal(d.meds.length, 1);
  assert.equal(d.meds[0].medicamento, 'Paracetamol');
  assert.equal(d.labs.length, 2);
  assert.equal(d.cuidados, 'Dieta blanda');
  assert.equal(d.proximasCitas.length, 1);
  assert.equal(d.proximasCitas[0].texto, 'Acudir en 2 semanas a consulta de Nefrología');
  assert.equal(d.proximasCitas[0].fecha, '10/06/2026');
});

test('normalizeRecetaHuDraft acepta varias consultas de seguimiento', () => {
  const d = normalizeRecetaHuDraft({
    proximasCitas: [
      { plazo: '2 semanas', servicio: 'Nefrología', texto: '', fecha: '' },
      { plazo: '1 mes', servicio: 'Cardiología', texto: '', fecha: '01/07/2026' },
    ],
  });
  assert.equal(d.proximasCitas.length, 2);
  assert.equal(d.proximasCitas[0].texto, 'Acudir en 2 semanas a consulta de Nefrología');
  assert.equal(d.proximasCitas[1].texto, 'Acudir en 1 mes a consulta de Cardiología');
  assert.equal(d.proximasCitas[1].fecha, '01/07/2026');
});

test('formatProximasCitasForPdf une líneas para el PDF', () => {
  const pdf = formatProximasCitasForPdf([
    { plazo: '2 semanas', servicio: 'Nefrología', texto: '', fecha: '10/06/2026' },
    { plazo: '1 mes', servicio: 'Cardiología', texto: '', fecha: '01/07/2026' },
  ]);
  assert.match(pdf.proximaCita, /Nefrología/);
  assert.match(pdf.proximaCita, /Cardiología/);
  assert.equal(pdf.proximaCitaFecha, '10/06/2026\n01/07/2026');
});

test('buildRecetaHuGeneratePayload incluye consultas múltiples en campos PDF', () => {
  const body = buildRecetaHuGeneratePayload({
    patient: { nombre: 'Pérez', registro: '123', servicio: 'CIRUGÍA GENERAL' },
    draft: {
      proximasCitas: [
        { plazo: '2 semanas', servicio: 'Nefrología', texto: '', fecha: '' },
        { plazo: '3 semanas', servicio: 'Oncología', texto: '', fecha: '20/06/2026' },
      ],
    },
    doctorName: 'Dr. X',
    cedulaProfesional: '999',
  });
  assert.equal(body.proximasCitas.length, 2);
  assert.match(body.proximaCita, /Nefrología/);
  assert.match(body.proximaCita, /Oncología/);
  assert.equal(body.proximaCitaFecha, '20/06/2026');
});

test('buildProximaCitaText arma frase de consulta', () => {
  assert.equal(
    buildProximaCitaText('2 semanas', 'Nefrología'),
    'Acudir en 2 semanas a consulta de Nefrología'
  );
});

test('buildRecetaHuGeneratePayload filtra filas vacías', () => {
  const body = buildRecetaHuGeneratePayload({
    patient: { nombre: 'Pérez', registro: '123', servicio: 'CIRUGÍA GENERAL' },
    draft: {
      meds: [
        { medicamento: 'A', presentacion: '', dosis: '' },
        { medicamento: '', presentacion: '', dosis: '' },
      ],
      labs: ['BH', '  ', ''],
      doctorName: 'Dr. X',
      cedulaProfesional: '999',
    },
    doctorName: 'Dr. X',
    cedulaProfesional: '999',
  });
  assert.equal(body.meds.length, 1);
  assert.deepEqual(body.labs, ['BH']);
  assert.equal(body.doctorName, 'Dr. X');
});

test('normalizeRecetaHuConsultServices deduplica servicios', () => {
  const list = normalizeRecetaHuConsultServices(['Nefrología', 'nefrología', 'Oncología']);
  assert.equal(list.length, 2);
  assert.ok(list.includes('Nefrología'));
});
