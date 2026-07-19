import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketsFromRecetaItems } from './features/estado-actual-meds.mjs';
import { classifyMedicationSoapCategory } from './med-receta-core.mjs';
import { insulinPumpNmSoapFragment, skipRecetaItemForInsulinPumpCarrier } from './insulin-pump-receta-display.mjs';

var INSULIN_ITEM = {
  id: 'ins-1',
  nombreRaw: 'INSULINA HUMANA RAPIDA',
  viaRaw: 'VIA INTRAVENOSA',
  dosisRaw: '100 UI',
  frecuenciaRaw: '-',
  suspendido: false,
};

var CARRIER_ITEM = {
  id: 'nacl-1',
  nombreRaw: 'CLORURO DE SODIO 0.9 % SOL INY 100 ML',
  viaRaw: 'VIA INTRAVENOSA',
  dosisRaw: '100 ML / VEL.INF: BOMBA EN ALGORITMO 2',
  frecuenciaRaw: 'CADA 24 HORAS',
  suspendido: false,
};

test('insulinPumpNmSoapFragment — bomba cuando insulina IV está en SOAP', () => {
  var items = [CARRIER_ITEM, INSULIN_ITEM];
  assert.equal(
    insulinPumpNmSoapFragment(items, [INSULIN_ITEM]),
    'BOMBA DE INSULINA EN ALGORITMO 2'
  );
});

test('bucketsFromRecetaItems — NM usa bomba en lugar de insulina IV', () => {
  var items = [CARRIER_ITEM, INSULIN_ITEM];
  var sel = { 'ins-1': true };
  var buckets = bucketsFromRecetaItems(items, sel, classifyMedicationSoapCategory);
  assert.equal(buckets.nm, 'BOMBA DE INSULINA EN ALGORITMO 2');
  assert.doesNotMatch(buckets.nm || '', /INSULINA HUMANA RAPIDA/i);
});

test('skipRecetaItemForInsulinPumpCarrier — excluye cloruro portador aunque esté en SOAP', () => {
  var items = [CARRIER_ITEM, INSULIN_ITEM];
  assert.equal(skipRecetaItemForInsulinPumpCarrier(CARRIER_ITEM, items), true);
  var sel = { 'nacl-1': true, 'ins-1': true };
  var buckets = bucketsFromRecetaItems(items, sel, classifyMedicationSoapCategory);
  assert.equal(buckets.nm, 'BOMBA DE INSULINA EN ALGORITMO 2');
  assert.doesNotMatch(
    [buckets.otros, buckets.nm, buckets.vasop].join(' '),
    /CLORURO DE SODIO/i
  );
});
