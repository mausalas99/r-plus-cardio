import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_LABELS,
  SECTION_LABELS,
  groupSections,
  buildGroupRowModel,
} from './expediente-group-row.mjs';

const SALA = { appMode: 'sala' };
const INTER = { appMode: 'interconsulta' };

test('groupSections: paciente is a leaf (datos collapse is in-pane, not nav)', () => {
  assert.deepEqual(groupSections('paciente', SALA), []);
  assert.deepEqual(groupSections('paciente', INTER), []);
});

test('groupSections: clinico follows mode', () => {
  assert.deepEqual(groupSections('clinico', SALA), ['estadoActual', 'historia', 'eventualidades']);
  assert.deepEqual(groupSections('clinico', INTER), ['notas', 'indica', 'vpo']);
});

test('groupSections: resultados and salida come from the existing maps', () => {
  assert.deepEqual(groupSections('resultados', SALA), ['tend', 'cult']);
  assert.deepEqual(groupSections('salida', SALA), ['icHoja', 'listado']);
  assert.deepEqual(groupSections('salida', INTER), []);
  assert.deepEqual(groupSections('manejo', SALA), []);
});

test('buildGroupRowModel: active group and section reflect the granular target', () => {
  const model = buildGroupRowModel('tend', SALA);
  const ids = model.map((g) => g.id);
  assert.deepEqual(ids, ['paciente', 'clinico', 'resultados', 'manejo', 'salida']);
  const resultados = model.find((g) => g.id === 'resultados');
  assert.equal(resultados.active, true);
  assert.equal(resultados.sections.find((s) => s.id === 'tend').active, true);
  assert.equal(resultados.sections.find((s) => s.id === 'cult').active, false);
  assert.equal(model.find((g) => g.id === 'paciente').active, false);
});

test('buildGroupRowModel: paciente is active for datos or todo without sub-pills', () => {
  const todoModel = buildGroupRowModel('todo', SALA);
  const pacTodo = todoModel.find((g) => g.id === 'paciente');
  assert.equal(pacTodo.active, true);
  assert.equal(pacTodo.leaf, true);
  assert.deepEqual(pacTodo.sections, []);

  const datosModel = buildGroupRowModel('datos', SALA);
  const pacDatos = datosModel.find((g) => g.id === 'paciente');
  assert.equal(pacDatos.active, true);
  assert.equal(pacDatos.leaf, true);
});

test('buildGroupRowModel: manejo is a leaf group in sala', () => {
  const model = buildGroupRowModel('manejo', SALA);
  const manejo = model.find((g) => g.id === 'manejo');
  assert.ok(manejo);
  assert.equal(manejo.active, true);
  assert.equal(manejo.leaf, true);
  assert.deepEqual(manejo.sections, []);
});

test('labels exist for every section that can appear', () => {
  ['paciente', 'clinico', 'resultados', 'manejo', 'salida'].forEach((g) => {
    assert.ok(GROUP_LABELS[g], 'group label ' + g);
    [SALA, INTER].forEach((st) => {
      groupSections(g, st).forEach((s) => assert.ok(SECTION_LABELS[s], 'section label ' + s));
    });
  });
});
