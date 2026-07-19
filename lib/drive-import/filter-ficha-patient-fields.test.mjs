import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterFichaDriveText,
  filterIdentificacionForHcImport,
} from './filter-ficha-patient-fields.mjs';

test('filterFichaDriveText removes registro and dx lines', () => {
  const text = [
    'NOMBRE: WENDY ORTIZ',
    'REGISTRO: 1128709-8',
    'ORIGEN: MONTERREY',
    'DX: ERC KDIGO 5',
    'ESCOLARIDAD: PREPARATORIA',
  ].join('\n');
  const filtered = filterFichaDriveText(text);
  assert.doesNotMatch(filtered, /REGISTRO/);
  assert.doesNotMatch(filtered, /DX:/);
  assert.doesNotMatch(filtered, /NOMBRE:/);
  assert.match(filtered, /ORIGEN/);
  assert.match(filtered, /ESCOLARIDAD/);
});

test('filterIdentificacionForHcImport strips patient-tab keys', () => {
  const out = filterIdentificacionForHcImport({
    registro: '123-4',
    dx: 'DIABETES',
    nombre: 'PACIENTE',
    edad: '40',
    cama: '204-3',
    lugarNacimiento: 'MTY',
    escolaridad: 'LIC',
  });
  assert.equal(out.registro, undefined);
  assert.equal(out.dx, undefined);
  assert.equal(out.nombre, undefined);
  assert.equal(out.lugarNacimiento, 'MTY');
  assert.equal(out.escolaridad, 'LIC');
});
