import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndicacionesPaste } from './med-receta-parse.mjs';
import {
  detectInsulinPumpAlgorithmFromRecetaBlock,
  detectInsulinPumpAlgorithmFromRecetaItems,
  formatInsulinPumpAlgoritmoLabel,
  isInsulinPumpCarrierMedicationItem,
  parseInsulinPumpAlgorithmFromText,
} from './insulin-pump-some-detect.mjs';

var SAMPLE_SOME =
  '11/07/2026 05:54:08 a.m.\tMEDICAMENTOS P2\tCLORURO DE SODIO 0.9 % SOL INY 100 ML\tVIA INTRAVENOSA\t100 ML / VEL.INF: BOMBA EN ALGORITMO 2\tCADA 24 HORAS\tNW\n' +
  '11/07/2026 05:54:09 a.m.\tMEDICAMENTOS P2\tINSULINA HUMANA RAPIDA\tVIA INTRAVENOSA\t100 UI\t-\tNW';

test('parseInsulinPumpAlgorithmFromText extrae algoritmo 1–4', () => {
  assert.equal(parseInsulinPumpAlgorithmFromText('100 ML / VEL.INF: BOMBA EN ALGORITMO 2'), 2);
  assert.equal(parseInsulinPumpAlgorithmFromText('100 ML / VEL.INF: BOMBA ALGORITMO 2'), 2);
  assert.equal(parseInsulinPumpAlgorithmFromText('BOMBA EN ALGORITMO 4'), 4);
  assert.equal(parseInsulinPumpAlgorithmFromText('BOMBA ALGORITMO 1'), 1);
  assert.equal(parseInsulinPumpAlgorithmFromText('A 60CC/ HRA'), null);
});

test('detectInsulinPumpAlgorithmFromRecetaItems — TSV bomba + insulina IV', () => {
  var parsed = parseIndicacionesPaste(SAMPLE_SOME);
  assert.equal(detectInsulinPumpAlgorithmFromRecetaItems(parsed.items), 2);
  assert.equal(
    formatInsulinPumpAlgoritmoLabel(detectInsulinPumpAlgorithmFromRecetaItems(parsed.items)),
    'BOMBA DE INSULINA EN ALGORITMO 2'
  );
});

test('detectInsulinPumpAlgorithmFromRecetaBlock — pasteRaw fallback', () => {
  assert.equal(
    detectInsulinPumpAlgorithmFromRecetaBlock({
      pasteRaw: SAMPLE_SOME,
      items: [],
    }),
    2
  );
  assert.equal(
    detectInsulinPumpAlgorithmFromRecetaBlock({
      pasteRaw: SAMPLE_SOME,
      items: parseIndicacionesPaste(SAMPLE_SOME).items,
    }),
    2
  );
});

test('detectInsulinPumpAlgorithmFromRecetaItems — sin insulina IV no activa bomba', () => {
  assert.equal(
    detectInsulinPumpAlgorithmFromRecetaItems([
      {
        nombreRaw: 'CLORURO DE SODIO 0.9 % SOL INY 100 ML',
        dosisRaw: '100 ML / VEL.INF: BOMBA EN ALGORITMO 3',
        viaRaw: 'VIA INTRAVENOSA',
        suspendido: false,
      },
    ]),
    null
  );
});

test('detectInsulinPumpAlgorithmFromRecetaItems — insulina SC no activa bomba IV', () => {
  assert.equal(
    detectInsulinPumpAlgorithmFromRecetaItems([
      {
        nombreRaw: 'INSULINA GLARGINA',
        dosisRaw: '12 UI',
        viaRaw: 'VIA SUBCUTANEA',
        suspendido: false,
      },
      {
        nombreRaw: 'CLORURO DE SODIO 0.9 % SOL INY 100 ML',
        dosisRaw: '100 ML / VEL.INF: BOMBA EN ALGORITMO 1',
        viaRaw: 'VIA INTRAVENOSA',
        suspendido: false,
      },
    ]),
    null
  );
});

test('detectInsulinPumpAlgorithmFromRecetaItems — algoritmo en P1 sin «EN» + insulina IV', () => {
  assert.equal(
    detectInsulinPumpAlgorithmFromRecetaItems([
      {
        nombreRaw: 'CLORURO DE SODIO 0.9 % SOL INY 100 ML',
        dosisRaw: '100 ML / VEL.INF: BOMBA ALGORITMO 2',
        viaRaw: 'VIA INTRAVENOSA',
        suspendido: false,
      },
      {
        nombreRaw: 'INSULINA HUMANA RAPIDA',
        dosisRaw: '100 UI',
        viaRaw: 'VIA INTRAVENOSA',
        suspendido: false,
      },
    ]),
    2
  );
});

test('isInsulinPumpCarrierMedicationItem — cloruro con algoritmo, no la insulina', () => {
  var items = [
    {
      nombreRaw: 'CLORURO DE SODIO 0.9 % SOL INY 100 ML',
      dosisRaw: '100 ML / VEL.INF: BOMBA ALGORITMO 1',
      viaRaw: 'VIA INTRAVENOSA',
      suspendido: false,
    },
    {
      nombreRaw: 'INSULINA HUMANA RAPIDA',
      dosisRaw: '100 UI',
      viaRaw: 'VIA INTRAVENOSA',
      suspendido: false,
    },
  ];
  assert.equal(
    isInsulinPumpCarrierMedicationItem(items[0], items),
    true
  );
  assert.equal(
    isInsulinPumpCarrierMedicationItem(items[1], items),
    false
  );
});
