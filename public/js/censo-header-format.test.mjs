import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCensoSalaTitleLine,
  formatCensoEquipoLine,
  normalizeCensoUbicacionValue,
  resolveCensoFimiLabel,
  CENSO_UBICACION_TORRE,
} from './censo-header-format.mjs';

test('formatCensoSalaTitleLine sala numérica', () => {
  assert.equal(formatCensoSalaTitleLine({ censoSala: '2' }), 'Censo de Sala 2');
});

test('formatCensoSalaTitleLine Torre HU sin sala', () => {
  assert.equal(formatCensoSalaTitleLine({ censoSala: CENSO_UBICACION_TORRE }), 'Censo de Torre HU');
});

test('normalizeCensoUbicacionValue migra censoTorre antiguo', () => {
  assert.equal(normalizeCensoUbicacionValue({ censoTorre: 'Torre HU' }), CENSO_UBICACION_TORRE);
});

test('resolveCensoFimiLabel personalizable', () => {
  assert.equal(resolveCensoFimiLabel({}), 'FIMI');
  assert.equal(resolveCensoFimiLabel({ censoFimiLabel: '  CIRUGÍA  ' }), 'CIRUGÍA');
});

test('formatCensoEquipoLine solo nombres', () => {
  var line = formatCensoEquipoLine({
    residenteR2: 'Ana R2',
    residenteR1a: 'Luis R1',
    residenteR1b: 'Mar R1',
    profesorName: 'Dr. Maestro',
  });
  assert.equal(line, 'Ana R2 · Luis R1 · Mar R1 · Dr. Maestro');
  assert.doesNotMatch(line, /R2:/);
});
