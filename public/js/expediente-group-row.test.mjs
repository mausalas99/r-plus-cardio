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
  // Cardionotas: single Hoja IC → leaf (no nested section pill).
  assert.deepEqual(groupSections('salida', SALA), []);
  assert.deepEqual(groupSections('salida', INTER), []);
  assert.deepEqual(groupSections('manejo', SALA), []);
});

test('buildGroupRowModel: active group and section reflect the granular target', () => {
  const model = buildGroupRowModel('tend', SALA);
  const ids = model.map((g) => g.id);
  assert.deepEqual(ids, ['clinico', 'resultados', 'salida']);
  const resultados = model.find((g) => g.id === 'resultados');
  assert.equal(resultados.active, true);
  assert.equal(resultados.sections.find((s) => s.id === 'tend').active, true);
  assert.equal(resultados.sections.find((s) => s.id === 'cult').active, false);
  assert.equal(model.find((g) => g.id === 'clinico').active, false);
});

test('buildGroupRowModel: Cardionotas omits Paciente/Pendientes and Manejo', () => {
  const todoModel = buildGroupRowModel('todo', SALA);
  assert.equal(todoModel.find((g) => g.id === 'paciente'), undefined);
  assert.equal(todoModel.find((g) => g.id === 'clinico').active, true);

  const model = buildGroupRowModel('manejo', SALA);
  assert.equal(model.find((g) => g.id === 'manejo'), undefined);
  const clinico = model.find((g) => g.id === 'clinico');
  assert.ok(clinico);
  assert.equal(clinico.active, true);
});

test('buildGroupRowModel: salida label is Hoja IC leaf in Cardionotas', () => {
  const model = buildGroupRowModel('icHoja', SALA);
  const salida = model.find((g) => g.id === 'salida');
  assert.ok(salida);
  assert.equal(salida.label, 'Hoja IC');
  assert.equal(salida.active, true);
  assert.equal(salida.leaf, true);
  assert.deepEqual(salida.sections, []);
});

test('labels exist for every section that can appear', () => {
  ['clinico', 'resultados', 'salida'].forEach((g) => {
    assert.ok(GROUP_LABELS[g], 'group label ' + g);
    [SALA, INTER].forEach((st) => {
      groupSections(g, st).forEach((s) => assert.ok(SECTION_LABELS[s], 'section label ' + s));
    });
  });
});
