import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeaderPath, buildHeaderPatientLine } from './header-context.mjs';

const SALA = { appMode: 'sala' };
const INTER = { appMode: 'interconsulta' };

test('buildHeaderPath: app tabs map to their names', () => {
  assert.equal(buildHeaderPath('lab', 'todo', SALA), 'Laboratorio');
  assert.equal(buildHeaderPath('med', 'todo', SALA), 'Manejo');
  assert.equal(buildHeaderPath('agenda', 'todo', SALA), 'Agenda');
});

test('buildHeaderPath: expediente shows group › section', () => {
  assert.equal(buildHeaderPath('nota', 'tend', SALA), 'Resultados › Tendencias');
  assert.equal(buildHeaderPath('nota', 'notas', INTER), 'Clínico › Nota de evolución');
  assert.equal(buildHeaderPath('nota', 'todo', SALA), 'Paciente');
  assert.equal(buildHeaderPath('nota', 'datos', SALA), 'Paciente');
});

test('buildHeaderPatientLine: name · bed · truncated dx', () => {
  assert.equal(buildHeaderPatientLine(null), '');
  assert.equal(buildHeaderPatientLine({ nombre: 'García López', cuarto: '412' }), 'García López · 412');
  assert.equal(buildHeaderPatientLine({ nombre: 'Pérez', cuarto: '', diagnosticosList: undefined }), 'Pérez');
});
