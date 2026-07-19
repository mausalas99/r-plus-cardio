import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInsulinRescateMedicationItem,
  insulinRescateItemsFromList,
  patientHasInsulinRescateMeds,
} from './insulin-rescate-detect.mjs';
import {
  insulinRescateNmSoapFragment,
  INSULIN_RESCATE_NM_LABEL,
} from './insulin-rescate-display.mjs';
import { bucketsFromRecetaItems } from './features/estado-actual-meds.mjs';
import { classifyMedicationSoapCategory } from './med-receta-core.mjs';

function rescateItem(id, units, min, max) {
  return {
    id: id,
    nombreRaw: 'INSULINA HUMANA RAPIDA',
    viaRaw: 'VIA SUBCUTANEA',
    dosisRaw:
      units +
      ' UI // CRITERIO PRN: EN CASO DE DESTROXTIS ENTRE ' +
      min +
      ' - ' +
      max,
    frecuenciaRaw: 'PRN',
    suspendido: false,
  };
}

test('isInsulinRescateMedicationItem detecta insulina SC PRN por glucometría', () => {
  assert.equal(isInsulinRescateMedicationItem(rescateItem('r1', 2, 140, 180)), true);
  assert.equal(
    isInsulinRescateMedicationItem({
      id: 'g1',
      nombreRaw: 'INSULINA GLARGINA 100 UI/ML SOL INY 3 ML',
      viaRaw: 'VIA SUBCUTANEA',
      dosisRaw: '10 UI //',
      frecuenciaRaw: 'CADA 24 HORAS',
      suspendido: false,
    }),
    false
  );
});

test('insulinRescateNmSoapFragment — una línea NM cuando hay selección SOAP', () => {
  var items = [rescateItem('r1', 2, 140, 180), rescateItem('r2', 4, 180, 220)];
  assert.equal(insulinRescateNmSoapFragment(items, [items[0]]), INSULIN_RESCATE_NM_LABEL);
  assert.equal(insulinRescateNmSoapFragment(items, []), null);
});

test('bucketsFromRecetaItems — NM agrupa rescates en una sola línea', () => {
  var items = [rescateItem('r1', 2, 140, 180), rescateItem('r2', 4, 180, 220)];
  var sel = { r1: true, r2: true };
  var buckets = bucketsFromRecetaItems(items, sel, classifyMedicationSoapCategory);
  assert.equal(buckets.nm, INSULIN_RESCATE_NM_LABEL);
});

test('patientHasInsulinRescateMeds', () => {
  var items = [rescateItem('r1', 2, 140, 180)];
  assert.equal(patientHasInsulinRescateMeds(items), true);
  assert.equal(insulinRescateItemsFromList(items).length, 1);
});
