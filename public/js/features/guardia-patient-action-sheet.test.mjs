import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  openPatientChart,
  shouldShowGuardiaPatientActionMenu,
} from './guardia-patient-action-sheet.mjs';

describe('openPatientChart', () => {
  const originalSelect = globalThis.selectPatient;
  const originalOpenSection = globalThis.openPaseSectionInNormal;

  afterEach(() => {
    if (originalSelect) globalThis.selectPatient = originalSelect;
    else delete globalThis.selectPatient;
    if (originalOpenSection) globalThis.openPaseSectionInNormal = originalOpenSection;
    else delete globalThis.openPaseSectionInNormal;
  });

  it('selects patient and opens expediente in normal view', () => {
    const calls = [];
    globalThis.selectPatient = (id) => calls.push(['select', id]);
    globalThis.openPaseSectionInNormal = (section) => calls.push(['section', section]);
    openPatientChart('pat-1');
    assert.deepEqual(calls, [
      ['select', 'pat-1'],
      ['section', 'expediente'],
    ]);
  });
});

describe('shouldShowGuardiaPatientActionMenu', () => {
  it('shows menu during turno activo', () => {
    assert.equal(
      shouldShowGuardiaPatientActionMenu({
        turnoActivo: true,
        entregaActive: false,
        onCallGuardiaReceiver: false,
        gridViewContext: 'GUARDIA',
      }),
      true
    );
  });

  it('hides menu pre-turno so census chips open entrega modal', () => {
    assert.equal(
      shouldShowGuardiaPatientActionMenu({
        turnoActivo: false,
        entregaActive: false,
        onCallGuardiaReceiver: true,
        gridViewContext: 'GUARDIA',
      }),
      false
    );
  });

  it('hides menu during entrega phase before turno activo', () => {
    assert.equal(
      shouldShowGuardiaPatientActionMenu({
        turnoActivo: false,
        entregaActive: true,
        onCallGuardiaReceiver: true,
        gridViewContext: 'HANDOFF',
      }),
      false
    );
  });

  it('shows menu when turno activo even if entrega phase flag still set', () => {
    assert.equal(
      shouldShowGuardiaPatientActionMenu({
        turnoActivo: true,
        entregaActive: true,
        onCallGuardiaReceiver: true,
        gridViewContext: 'GUARDIA',
      }),
      true
    );
  });

  it('hides menu for non-receiver outside turno', () => {
    assert.equal(
      shouldShowGuardiaPatientActionMenu({
        turnoActivo: false,
        entregaActive: false,
        onCallGuardiaReceiver: false,
        gridViewContext: 'GUARDIA',
      }),
      false
    );
  });
});
