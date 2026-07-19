'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateHistoriaClinicaPut,
  migrateLegacyHistoriaData,
} = require('./historia-clinica-validate.js');

test('migrateLegacyHistoriaData maps flat sections to nested', () => {
  const out = migrateLegacyHistoriaData({
    patientId: 'p1',
    ficha: 'Juan, 49 años',
    app: 'Metformina. DM2.',
    ahf: 'Madre DM',
    apnp: 'Tabaco negado',
    peea: 'Ingreso por sangrado',
  });
  assert.equal(out.app.descripcionDetallada, 'Metformina. DM2.');
  assert.equal(out.padecimientoActual, 'Ingreso por sangrado');
  assert.equal(out.identificacion.informante, 'Juan, 49 años');
  assert.equal(out.ficha, undefined);
  assert.equal(out.peea, undefined);
});

test('validateHistoriaClinicaPut accepts nested changedKeys', () => {
  const out = validateHistoriaClinicaPut({
    roomId: 'r1',
    patientId: 'p1',
    expectedVersion: 0,
    changedKeys: ['motivoConsulta', 'app', 'padecimientoActual'],
    data: {
      patientId: 'p1',
      motivoConsulta: 'Dolor',
      app: { conditions: [], descripcionDetallada: '', medicamentosActuales: '', hospitalizacionesPrevias: '' },
      padecimientoActual: 'Narrativa',
    },
  });
  assert.equal(out.ok, true);
  assert.equal(out.mutation.data.motivoConsulta, 'Dolor');
});

test('validateHistoriaClinicaPut normalizes legacy flat data on PUT', () => {
  const out = validateHistoriaClinicaPut({
    roomId: 'r1',
    patientId: 'p1',
    expectedVersion: 0,
    changedKeys: ['app'],
    data: { patientId: 'p1', app: 'metformina' },
  });
  assert.equal(out.ok, true);
  assert.equal(out.mutation.data.app.descripcionDetallada, 'metformina');
});
