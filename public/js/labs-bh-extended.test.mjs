import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBH_ } from './labs.js';

const BH_REAL = [
  'HEMATOLOGIA',
  'BIOMETRIA HEMATICA COMPLETA',
  'Estudio Resultado Unidades Valor de Referencia',
  'RBC B 3.11 M/uL 4.04 - 6.13',
  'HGB B 9.39 g/dL 12.20 - 18.10',
  'HCT B 29.1 % 37.7 - 53.7',
  'MCV * 93 fL 80 - 97',
  'MCH * 30.2 pg 27.0 - 31.2',
  'MCHC * 32.3 g/dL 29.9 - 34.2',
  'RDW A 16.8 % 11.6 - 14.8',
  'WBC A 23.10 K/uL 4.00 - 11.00',
  'NEU A 21.70 K/uL 2.00 - 6.90',
  'NEU% A 93.8 % 37.0 - 80.0',
  'LYM B 0.50 K/uL 0.60 - 3.40',
  'LYM% B 2.2 % 10.0 - 50.0',
  'MONO * 0.847 K/uL 0.000 - 0.900',
  'MONO% * 3.67 % 0.00 - 12.00',
  'EOS * 0.000 K/uL 0.000 - 0.700',
  'EOS% * 0.00 % 0.00 - 7.00',
  'BASO * 0.072 K/uL 0.000 - 0.200',
  'BASO% * 0.31 % 0.00 - 2.50',
  'PLT * 156.00 K/uL 142.00 - 424.00',
  'MPV * 7.7 fL 7.4 - 10.4'
].join('\n');

describe('parseBH_ extended', () => {
  it('returns an object with `visible` and `extras` (refactored shape)', () => {
    const r = parseBH_(BH_REAL);
    assert.ok(r && typeof r === 'object', 'parseBH_ should return an object');
    assert.strictEqual(typeof r.visible, 'string');
    assert.ok(r.extras && typeof r.extras === 'object');
  });

  it('visible line is compact BH (core indices + Neu/Eos absolutes; sin RBC/CHCM/RDW/MPV)', () => {
    const { visible } = parseBH_(BH_REAL);
    assert.match(visible, /\bHb\b/);
    assert.match(visible, /\bHto\b/);
    assert.match(visible, /\bVCM\b/);
    assert.match(visible, /\bHCM\b/);
    assert.match(visible, /\bLeu\b/);
    assert.match(visible, /\bNeu\b/);
    assert.match(visible, /\bEos\b/);
    assert.match(visible, /\bPlt\b/);
    assert.match(visible, /\bNeu\s+21\.7\*?/);
    assert.match(visible, /\bEos\s+0\b/);
    assert.doesNotMatch(visible, /\bRBC\b/);
    assert.doesNotMatch(visible, /\bCHCM\b/);
    assert.doesNotMatch(visible, /\bRDW\b/);
    assert.doesNotMatch(visible, /\bMPV\b/);
    assert.doesNotMatch(visible, /\bLin\b/);
    assert.doesNotMatch(visible, /\bMono\b/);
    assert.doesNotMatch(visible, /\bBaso\b/);
    assert.doesNotMatch(visible, /Pct\b|%/);
  });

  it('extras contains RBC/CHCM/RDW/MPV and other white-cell absolutes and percentages (not Neu/Eos)', () => {
    const { extras } = parseBH_(BH_REAL);
    assert.strictEqual(extras.RBC, '3.11*');
    assert.strictEqual(extras.CHCM, '32.3');
    assert.strictEqual(extras.RDW, '16.8*');
    assert.strictEqual(extras.MPV, '7.7');
    assert.strictEqual(extras.Neu, undefined);
    assert.strictEqual(extras.Eos, undefined);
    assert.strictEqual(extras.Lin,  '0.50');
    assert.strictEqual(extras.Mono, '0.847');
    assert.strictEqual(extras.Baso, '0.072');
    assert.strictEqual(extras.NeuPct,  '93.8');
    assert.strictEqual(extras.LinPct,  '2.2');
    assert.strictEqual(extras.MonoPct, '3.67');
    assert.strictEqual(extras.EosPct,  '0.00');
    assert.strictEqual(extras.BasoPct, '0.31');
  });

  it('distinguishes NEU from NEU% (no key collision)', () => {
    const { visible, extras } = parseBH_(BH_REAL);
    assert.match(visible, /\bNeu\s+/);
    assert.strictEqual(extras.Neu, undefined);
    assert.notStrictEqual(extras.NeuPct, '21.7');
    assert.strictEqual(extras.NeuPct, '93.8');
  });

  it('parses MCHC, RDW, MPV into extras (extended line) correctly', () => {
    const { extras } = parseBH_(BH_REAL);
    assert.strictEqual(extras.CHCM, '32.3');
    assert.strictEqual(extras.RDW, '16.8*');
    assert.strictEqual(extras.MPV, '7.7');
  });

  it('manual frotis fields (Bandas, Mielo, ...) end up in extras when present', () => {
    const withFrotis = BH_REAL + '\n\nFROTIS DE SANGRE PERIFERICA\nBANDAS 4 %\nMIELOCITOS 1 %\nMETAMIELOCITOS 0 %\nPROMIELOCITOS 0 %\nBLASTOS 0 %';
    const { extras } = parseBH_(withFrotis);
    assert.strictEqual(extras.Bandas, '4');
    assert.strictEqual(extras.Mielo, '1');
    assert.strictEqual(extras.Metamielo, '0');
    assert.strictEqual(extras.Promielo, '0');
    assert.strictEqual(extras.Blastos, '0');
  });

  it('returns empty visible (`""`) when no BH or coag data present', () => {
    const r = parseBH_('NO HAY BH AQUI');
    assert.strictEqual(r.visible, '');
    assert.deepStrictEqual(r.extras, {});
  });
});
