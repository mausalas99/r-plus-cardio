import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBhTrendValuesFromResLab, bhTrendDisplayTitle } from './labs.js';

describe('parseBhTrendValuesFromResLab', () => {
  it('bloque multilínea: Segmentados, coag y claves internas', () => {
    const entry =
      'BH:\n' +
      '  Dif.\tSeg 71%*  Lin 25%  Meta 3%*\n' +
      '  Coag.\tTP 14.2*  INR 1.22*  Fib 405*  DD 2227*';
    const cells = parseBhTrendValuesFromResLab(entry);
    assert.strictEqual(cells.NeuPct.val, '71');
    assert.equal(cells.NeuPct.ab, true);
    assert.strictEqual(cells.LinPct.val, '25');
    assert.strictEqual(cells.Metamielo.val, '3');
    assert.strictEqual(cells.TP.val, '14.2');
    assert.strictEqual(cells.Fib.val, '405');
    assert.strictEqual(cells.DD.val, '2227');
  });

  it('fila COAG separada', () => {
    const cells = parseBhTrendValuesFromResLab('COAG\tTP 18.6*  TTP 39.4*  INR 1.6*');
    assert.strictEqual(cells.TP.val, '18.6');
    assert.strictEqual(cells.TTP.val, '39.4');
    assert.strictEqual(cells.INR.val, '1.6');
  });

  it('línea compacta BH', () => {
    const cells = parseBhTrendValuesFromResLab('BH\tHb 9.4  Leu 23  Plt 140');
    assert.strictEqual(cells.Hb.val, '9.4');
    assert.strictEqual(cells.Leu.val, '23');
    assert.strictEqual(cells.Plt.val, '140');
  });
});

describe('bhTrendDisplayTitle', () => {
  it('NeuPct → Segmentados', () => {
    assert.equal(bhTrendDisplayTitle('NeuPct'), 'Segmentados');
    assert.equal(bhTrendDisplayTitle('Bandas'), 'Bandas');
  });
});
