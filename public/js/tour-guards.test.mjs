import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncGuidedTourContext,
  shouldSuppressGuardiaEntregaBootstrap,
  shouldShowGuardiaBoardWithoutEntrega,
  shouldOpenEntregaRosterForTour,
} from './tour-guards.mjs';

test('guardia v7 tour suppresses entrega bootstrap on modo guardia steps', () => {
  syncGuidedTourContext({ active: false, stepId: null });
  assert.equal(shouldSuppressGuardiaEntregaBootstrap(), false);

  syncGuidedTourContext({ active: true, stepId: 'gv7_guardia_tab' });
  assert.equal(shouldSuppressGuardiaEntregaBootstrap(), true);
  assert.equal(shouldShowGuardiaBoardWithoutEntrega('gv7_guardia_tab'), true);
  assert.equal(shouldOpenEntregaRosterForTour('gv7_guardia_tab'), false);

  syncGuidedTourContext({ active: true, stepId: 'gv7_entrega_roster' });
  assert.equal(shouldSuppressGuardiaEntregaBootstrap(), false);
  assert.equal(shouldShowGuardiaBoardWithoutEntrega('gv7_entrega_roster'), false);
  assert.equal(shouldOpenEntregaRosterForTour('gv7_entrega_roster'), true);
});
