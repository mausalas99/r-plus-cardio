import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQuickOutputAction, listadoHasProblems } from './quick-output.mjs';

test('listadoHasProblems true cuando hay activos', () => {
  assert.equal(listadoHasProblems({ activos: [{ descripcion: 'x' }], inactivos: [] }), true);
});

test('listadoHasProblems true cuando hay inactivos', () => {
  assert.equal(listadoHasProblems({ activos: [], inactivos: [{ descripcion: 'y' }] }), true);
});

test('listadoHasProblems ignora problemas vacíos', () => {
  assert.equal(listadoHasProblems({ activos: [{ descripcion: '   ' }], inactivos: [{ descripcion: '' }] }), false);
});

test('listadoHasProblems false sin listado', () => {
  assert.equal(listadoHasProblems(null), false);
  assert.equal(listadoHasProblems(undefined), false);
  assert.equal(listadoHasProblems({}), false);
});

test('resolveQuickOutputAction: format html siempre gana', () => {
  const a = resolveQuickOutputAction({ format: 'html', appMode: 'sala', activeInner: 'notas', listado: null });
  assert.deepEqual(a, { kind: 'html' });
});

test('resolveQuickOutputAction: format txt siempre gana', () => {
  const a = resolveQuickOutputAction({ format: 'txt', appMode: 'interconsulta', activeInner: 'indica', listado: null });
  assert.deepEqual(a, { kind: 'txt' });
});

test('resolveQuickOutputAction Sala + listado con problemas → listado', () => {
  const a = resolveQuickOutputAction({
    format: 'docx', appMode: 'sala', activeInner: 'notas',
    listado: { activos: [{ descripcion: 'EPOC' }], inactivos: [] },
  });
  assert.deepEqual(a, { kind: 'listado' });
});

test('resolveQuickOutputAction Sala sin problemas → listado_empty (toast)', () => {
  const a = resolveQuickOutputAction({
    format: 'docx', appMode: 'sala', activeInner: 'listado',
    listado: { activos: [], inactivos: [] },
  });
  assert.equal(a.kind, 'listado_empty');
  assert.match(a.message, /problema/i);
});

test('resolveQuickOutputAction Interconsulta + tab indica → indicaciones', () => {
  const a = resolveQuickOutputAction({
    format: 'docx', appMode: 'interconsulta', activeInner: 'indica',
    listado: null,
  });
  assert.deepEqual(a, { kind: 'indicaciones' });
});

test('resolveQuickOutputAction Interconsulta + tab notas → nota', () => {
  const a = resolveQuickOutputAction({
    format: 'docx', appMode: 'interconsulta', activeInner: 'notas',
    listado: null,
  });
  assert.deepEqual(a, { kind: 'nota' });
});

test('resolveQuickOutputAction Interconsulta + listado problemas no afecta → nota', () => {
  // En interconsulta el listado no debe usarse aunque exista (no hay tab listado en IC).
  const a = resolveQuickOutputAction({
    format: 'docx', appMode: 'interconsulta', activeInner: 'tend',
    listado: { activos: [{ descripcion: 'x' }], inactivos: [] },
  });
  assert.deepEqual(a, { kind: 'nota' });
});
