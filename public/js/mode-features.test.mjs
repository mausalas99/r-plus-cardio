import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isModeSala,
  getDefaultServicio,
  getDefaultCuarto,
  getDefaultCama,
  migrateToV3,
} from './mode-features.mjs';

test('isModeSala devuelve true cuando settings.appMode === "sala"', () => {
  assert.equal(isModeSala({ appMode: 'sala' }), true);
});

test('isModeSala devuelve false cuando settings.appMode === "interconsulta"', () => {
  assert.equal(isModeSala({ appMode: 'interconsulta' }), false);
});

test('isModeSala default a true (sala) cuando appMode falta', () => {
  assert.equal(isModeSala({}), true);
  assert.equal(isModeSala(null), true);
  assert.equal(isModeSala(undefined), true);
});

test('getDefaultServicio devuelve string trimeado', () => {
  assert.equal(getDefaultServicio({ defaultServicio: '  CIRUGÍA GENERAL  ' }), 'CIRUGÍA GENERAL');
});

test('getDefaultServicio devuelve "" cuando no existe', () => {
  assert.equal(getDefaultServicio({}), '');
  assert.equal(getDefaultServicio(null), '');
});

test('getDefaultCuarto y getDefaultCama devuelven string trimeado', () => {
  assert.equal(getDefaultCuarto({ defaultCuarto: ' 214 ' }), '214');
  assert.equal(getDefaultCama({ defaultCama: ' 4 ' }), '4');
  assert.equal(getDefaultCuarto({}), '');
});

test('migrateToV3 setea appMode=sala cuando falta y retorna true', () => {
  const settings = {};
  const migrated = migrateToV3(settings);
  assert.equal(migrated, true);
  assert.equal(settings.appMode, 'sala');
  assert.equal(settings.defaultServicio, '');
  assert.equal(settings.defaultCuarto, '');
  assert.equal(settings.defaultCama, '');
  assert.equal(settings._v3MigrationDone, true);
});

test('migrateToV3 idempotente: no toca settings ya migrados', () => {
  const settings = { appMode: 'interconsulta', defaultServicio: 'CARDIO', _v3MigrationDone: true };
  const migrated = migrateToV3(settings);
  assert.equal(migrated, false);
  assert.equal(settings.appMode, 'interconsulta');
  assert.equal(settings.defaultServicio, 'CARDIO');
});

test('migrateToV3 conserva appMode preexistente si está seteado', () => {
  const settings = { appMode: 'interconsulta' };
  migrateToV3(settings);
  assert.equal(settings.appMode, 'interconsulta');
});
