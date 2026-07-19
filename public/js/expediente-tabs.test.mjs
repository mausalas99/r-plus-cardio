import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSOLIDATED_TABS_SALA,
  resolveConsolidatedTarget,
  consolidatedTabForGranular,
  migrateGranularInner,
  defaultGranularForConsolidatedTab,
  consolidatedInnerTabButtonId,
  getConsolidatedTabs,
  getClinicoSections,
  getSalidaSections,
  isClinicoTabHidden,
  isManejoSectionHidden,
  isClinicoCompositeVisible,
  getConsolidatedCompositeState,
} from './expediente-tabs.mjs';

const INTER = { appMode: 'interconsulta', hideManejoSection: false };
const SALA = { appMode: 'sala', hideManejoSection: false };
const HIDE_MANEJO_INTER = { appMode: 'interconsulta', hideManejoSection: true, clinicoUnlocked: true };
const HIDE_MANEJO_LEGACY = { appMode: 'interconsulta', hideClinicoTab: true, clinicoUnlocked: true };

test('resolveConsolidatedTarget maps granular tabs to composite groups (interconsulta)', () => {
  assert.deepEqual(resolveConsolidatedTarget('todo', INTER), { tab: 'paciente', section: null });
  assert.deepEqual(resolveConsolidatedTarget('notas', INTER), { tab: 'clinico', section: 'notas' });
  assert.deepEqual(resolveConsolidatedTarget('manejo', INTER), { tab: 'clinico', section: 'notas' });
  assert.deepEqual(resolveConsolidatedTarget('tend', INTER), { tab: 'resultados', section: 'tend' });
  assert.deepEqual(resolveConsolidatedTarget('recetaHu', INTER), { tab: 'salida', section: null });
  assert.deepEqual(resolveConsolidatedTarget('listado', INTER), { tab: 'paciente', section: null });
});

test('resolveConsolidatedTarget maps listado and recetaHu to salida in sala', () => {
  assert.deepEqual(resolveConsolidatedTarget('listado', SALA), { tab: 'salida', section: 'listado' });
  assert.deepEqual(resolveConsolidatedTarget('recetaHu', SALA), { tab: 'salida', section: 'recetaHu' });
  assert.deepEqual(resolveConsolidatedTarget('manejo', SALA), { tab: 'paciente', section: null });
});

test('CONSOLIDATED_TABS_SALA has no top-level estadoActual', () => {
  assert.deepEqual(CONSOLIDATED_TABS_SALA, ['paciente', 'clinico', 'resultados', 'salida']);
});

test('resolveConsolidatedTarget estadoActual sala routes to clinico segment', () => {
  assert.deepEqual(resolveConsolidatedTarget('estadoActual', SALA), {
    tab: 'clinico',
    section: 'estadoActual',
  });
});

test('resolveConsolidatedTarget eventualidades sala routes to clinico segment', () => {
  assert.deepEqual(resolveConsolidatedTarget('eventualidades', SALA), {
    tab: 'clinico',
    section: 'eventualidades',
  });
});

test('estadoActual is not a consolidated top tab in either mode', () => {
  assert.equal(getConsolidatedTabs(INTER).includes('estadoActual'), false);
  assert.equal(getConsolidatedTabs(SALA).includes('estadoActual'), false);
});

test('migrateGranularInner keeps known tabs and falls back to todo', () => {
  assert.equal(migrateGranularInner('indica', INTER), 'indica');
  assert.equal(migrateGranularInner('unknown', INTER), 'todo');
  assert.equal(migrateGranularInner(null, INTER), 'todo');
  assert.equal(migrateGranularInner('notas', SALA), 'historia');
  assert.equal(migrateGranularInner('recetaHu', SALA), 'recetaHu');
  assert.equal(migrateGranularInner('listado', INTER), 'todo');
  assert.equal(migrateGranularInner('estadoActual', SALA), 'estadoActual');
  assert.equal(migrateGranularInner('estadoActual', INTER), 'todo');
});

test('defaultGranularForConsolidatedTab returns sensible defaults per mode', () => {
  assert.equal(defaultGranularForConsolidatedTab('paciente', INTER), 'todo');
  assert.equal(defaultGranularForConsolidatedTab('clinico', INTER), 'notas');
  assert.equal(defaultGranularForConsolidatedTab('resultados', INTER), 'tend');
  assert.equal(defaultGranularForConsolidatedTab('salida', INTER), 'recetaHu');
  assert.equal(defaultGranularForConsolidatedTab('clinico', SALA), 'estadoActual');
  assert.equal(defaultGranularForConsolidatedTab('salida', SALA), 'listado');
});

test('consolidatedInnerTabButtonId resolves composite button ids', () => {
  assert.equal(consolidatedInnerTabButtonId('notas', INTER), 'itab-clinico');
  assert.equal(consolidatedInnerTabButtonId('todo', INTER), 'itab-paciente');
  assert.equal(consolidatedInnerTabButtonId('recetaHu', INTER), 'itab-salida');
  assert.equal(consolidatedInnerTabButtonId('listado', SALA), 'itab-salida');
  assert.equal(consolidatedInnerTabButtonId('clinico', INTER), 'itab-clinico');
  assert.equal(consolidatedInnerTabButtonId('estadoActual', SALA), 'itab-clinico');
  assert.equal(consolidatedInnerTabButtonId('eventualidades', SALA), 'itab-clinico');
});

test('consolidatedTabForGranular returns top-level composite tab id', () => {
  assert.equal(consolidatedTabForGranular('cult', INTER), 'resultados');
  assert.equal(consolidatedTabForGranular('datos', INTER), 'paciente');
});

test('getClinicoSections differs by mode (manejo hidden globally)', () => {
  assert.deepEqual(getClinicoSections(INTER), ['notas', 'indica', 'vpo']);
  assert.deepEqual(getClinicoSections(SALA), ['estadoActual', 'historia', 'eventualidades']);
});

test('getSalidaSections only in sala', () => {
  assert.deepEqual(getSalidaSections(SALA), ['listado']);
  assert.deepEqual(getSalidaSections(INTER), []);
});

test('isManejoSectionHidden is always true (global product policy)', () => {
  assert.equal(isManejoSectionHidden({}), true);
  assert.equal(isManejoSectionHidden({ hideManejoSection: false, clinicoUnlocked: true }), true);
  assert.equal(isManejoSectionHidden({ hideManejoSection: true, clinicoUnlocked: true }), true);
  assert.equal(isManejoSectionHidden(HIDE_MANEJO_LEGACY), true);
});

test('inter clinico sections include vpo and no manejo or historia', () => {
  assert.deepEqual(getClinicoSections(INTER), ['notas', 'indica', 'vpo']);
});

test('sala salida sections exclude vpo and recetaHu under Cardionotas gate', () => {
  assert.deepEqual(getSalidaSections(SALA), ['listado']);
});

test('resolveConsolidatedTarget vpo in inter maps to clinico', () => {
  assert.deepEqual(resolveConsolidatedTarget('vpo', INTER), { tab: 'clinico', section: 'vpo' });
});

test('resolveConsolidatedTarget vpo in sala maps to salida', () => {
  assert.deepEqual(resolveConsolidatedTarget('vpo', SALA), { tab: 'salida', section: 'vpo' });
});

test('interconsulta keeps clinico tab when only manejo is hidden', () => {
  assert.equal(isClinicoCompositeVisible(INTER), true);
  assert.equal(isClinicoCompositeVisible(HIDE_MANEJO_INTER), true);
  assert.equal(getConsolidatedTabs(HIDE_MANEJO_INTER).includes('clinico'), true);
  assert.deepEqual(getClinicoSections(HIDE_MANEJO_INTER), ['notas', 'indica', 'vpo']);
});

test('sala keeps clinico for historia when manejo is hidden', () => {
  const hiddenSala = { appMode: 'sala', hideManejoSection: true, clinicoUnlocked: true };
  assert.equal(isClinicoCompositeVisible(hiddenSala), true);
  assert.equal(getConsolidatedTabs(hiddenSala).includes('clinico'), true);
  assert.deepEqual(getClinicoSections(hiddenSala), ['estadoActual', 'historia', 'eventualidades']);
});

test('migrateGranularInner keeps notas and indica when manejo is hidden (inter)', () => {
  assert.equal(migrateGranularInner('notas', HIDE_MANEJO_INTER), 'notas');
  assert.equal(migrateGranularInner('indica', HIDE_MANEJO_INTER), 'indica');
  assert.equal(migrateGranularInner('manejo', HIDE_MANEJO_INTER), 'notas');
});

test('consolidatedInnerTabButtonId keeps clinico for notas when manejo hidden', () => {
  assert.equal(consolidatedInnerTabButtonId('notas', HIDE_MANEJO_INTER), 'itab-clinico');
  assert.equal(consolidatedInnerTabButtonId('indica', HIDE_MANEJO_INTER), 'itab-clinico');
  assert.equal(consolidatedInnerTabButtonId('manejo', HIDE_MANEJO_INTER), 'itab-clinico');
});

test('resolveConsolidatedTarget redirects manejo to notas when hidden (inter)', () => {
  assert.deepEqual(resolveConsolidatedTarget('manejo', HIDE_MANEJO_INTER), {
    tab: 'clinico',
    section: 'notas',
  });
});

test('legacy isClinicoTabHidden only true in sala', () => {
  assert.equal(isClinicoTabHidden(HIDE_MANEJO_INTER), false);
  assert.equal(isClinicoTabHidden({ appMode: 'sala', hideClinicoTab: true, clinicoUnlocked: true }), true);
});

test('getConsolidatedCompositeState keeps clinico visible in sala for historia', () => {
  const hiddenSala = { appMode: 'sala', hideManejoSection: true, clinicoUnlocked: true };
  const state = getConsolidatedCompositeState('todo', hiddenSala);
  assert.equal(state.paciente.visible, true);
  assert.equal(state.paciente.active, true);
  assert.equal(state.clinico.visible, true);
  assert.equal(state.clinico.active, false);
});

test('getConsolidatedCompositeState keeps clinico visible in inter when only manejo hidden', () => {
  const state = getConsolidatedCompositeState('notas', HIDE_MANEJO_INTER);
  assert.equal(state.clinico.visible, true);
  assert.equal(state.clinico.active, true);
  assert.equal(state.estadoActual, undefined);
});
