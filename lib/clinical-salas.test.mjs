import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clinicalServiceForSala, clinicalSalaUsesAbcOnlyRotation } from './clinical-salas.mjs';

describe('clinical-salas', () => {
  it('clinicalServiceForSala maps ward labels', () => {
    assert.equal(clinicalServiceForSala('Sala 1'), 'Sala');
    assert.equal(clinicalServiceForSala('Torre HU'), 'Torre HU');
    assert.equal(clinicalServiceForSala('Área A/Pensionistas'), 'Área A/Pensionistas');
    assert.equal(clinicalServiceForSala('Area A/Pensionistas'), 'Área A/Pensionistas');
    assert.equal(clinicalServiceForSala(''), '');
  });

  it('clinicalSalaUsesAbcOnlyRotation for Torre and Área A', () => {
    assert.equal(clinicalSalaUsesAbcOnlyRotation('Torre HU'), true);
    assert.equal(clinicalSalaUsesAbcOnlyRotation('Área A/Pensionistas'), true);
    assert.equal(clinicalSalaUsesAbcOnlyRotation('Sala 1'), false);
  });

  it('clinicalServiceForSala maps Interconsultas UX Eme', () => {
    assert.equal(clinicalServiceForSala('Interconsultas'), 'Interconsultas');
    assert.equal(clinicalServiceForSala('UX'), 'UX');
    assert.equal(clinicalServiceForSala('Eme'), 'Eme');
  });

  it('clinicalSalaUsesAbcOnlyRotation for Interconsultas UX Eme', () => {
    assert.equal(clinicalSalaUsesAbcOnlyRotation('Interconsultas'), true);
    assert.equal(clinicalSalaUsesAbcOnlyRotation('UX'), true);
    assert.equal(clinicalSalaUsesAbcOnlyRotation('Eme'), true);
  });
});
