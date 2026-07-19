import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyListado, addProblema, removeProblema, reorderProblema } from './listado-problemas-core.mjs';

test('emptyListado retorna estructura inicial vacía', () => {
  const l = emptyListado('07/05/2026', '09:00');
  assert.equal(l.fecha, '07/05/2026');
  assert.equal(l.hora, '09:00');
  assert.deepEqual(l.activos, []);
  assert.deepEqual(l.inactivos, []);
});

test('addProblema agrega a la sección correcta y devuelve nuevo objeto', () => {
  const l = emptyListado('07/05/2026', '09:00');
  const p = { fecha: '03/05/2026', descripcion: 'NAC' };
  const l2 = addProblema(l, 'activos', p);
  assert.equal(l2.activos.length, 1);
  assert.equal(l2.activos[0].descripcion, 'NAC');
  assert.ok(l2.activos[0].id, 'el problema agregado tiene id');
  assert.equal(l.activos.length, 0, 'no muta el original');
});

test('addProblema rechaza sección inválida', () => {
  const l = emptyListado('07/05/2026', '09:00');
  assert.throws(() => addProblema(l, 'otros', { descripcion: 'x' }), /sección inválida/i);
});

test('removeProblema quita por id', () => {
  let l = emptyListado('07/05/2026', '09:00');
  l = addProblema(l, 'activos', { descripcion: 'A' });
  l = addProblema(l, 'activos', { descripcion: 'B' });
  const idA = l.activos[0].id;
  const l2 = removeProblema(l, 'activos', idA);
  assert.equal(l2.activos.length, 1);
  assert.equal(l2.activos[0].descripcion, 'B');
});

test('removeProblema con id inexistente no cambia nada', () => {
  let l = emptyListado('07/05/2026', '09:00');
  l = addProblema(l, 'activos', { descripcion: 'A' });
  const l2 = removeProblema(l, 'activos', 'no-existe');
  assert.equal(l2.activos.length, 1);
});

test('reorderProblema mueve fila de fromIndex a toIndex', () => {
  let l = emptyListado('07/05/2026', '09:00');
  l = addProblema(l, 'activos', { descripcion: 'A' });
  l = addProblema(l, 'activos', { descripcion: 'B' });
  l = addProblema(l, 'activos', { descripcion: 'C' });
  const l2 = reorderProblema(l, 'activos', 0, 2);
  assert.deepEqual(l2.activos.map(p => p.descripcion), ['B', 'C', 'A']);
});

test('reorderProblema con índices fuera de rango es no-op', () => {
  let l = emptyListado('07/05/2026', '09:00');
  l = addProblema(l, 'activos', { descripcion: 'A' });
  const l2 = reorderProblema(l, 'activos', 5, 10);
  assert.deepEqual(l2.activos.map(p => p.descripcion), ['A']);
});

test('round-trip JSON preserva estructura', () => {
  let l = emptyListado('07/05/2026', '09:00');
  l = addProblema(l, 'activos', { fecha: '03/05/2026', descripcion: 'NAC' });
  l = addProblema(l, 'inactivos', { fecha: '01/01/2020', descripcion: 'Apendicectomía' });
  const json = JSON.stringify(l);
  const back = JSON.parse(json);
  assert.deepEqual(back, l);
});
