import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCultivoBlockStartLine,
  isLabSectionHeaderLine,
  splitResLabsByTipo,
  parseCultureBlockFromLineArray,
  findCultivoChunkInSet,
  isCultureTableHeaderLine,
} from './cultivo-block-core.mjs';

describe('isCultivoBlockStartLine', () => {
  var positives = [
    'CULTIVO DE ORINA',
    'UROCULTIVO 01/05: E. COLI',
    'HEMOCULTIVO: negativo',
    'BACILOSCOPIA: negativa',
    'CULTIVO DE MICOBACTERIAS 03/04: negativo',
    'ATB R: CAZ',
    'Cuenta: +100 UFC',
    '• Pseudomonas',
    'Cultivos',
    'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS',
    'ESPONJA RECTAL',
  ];

  positives.forEach(function (line) {
    it('recognizes start line: ' + line.slice(0, 40), function () {
      assert.equal(isCultivoBlockStartLine(line), true);
    });
  });

  it('rejects non-cultivo lines', function () {
    assert.equal(isCultivoBlockStartLine(''), false);
    assert.equal(isCultivoBlockStartLine('BH 12.5 4.1'), false);
    assert.equal(isCultivoBlockStartLine('SALA MEDICINA INTERNA'), false);
  });
});

describe('isLabSectionHeaderLine', () => {
  it('recognizes base lab headers', function () {
    assert.equal(isLabSectionHeaderLine('BH 12.5'), true);
    assert.equal(isLabSectionHeaderLine('FROTIS nasal'), true);
  });

  it('recognizes SEROL and HECES section headers', function () {
    assert.equal(isLabSectionHeaderLine('SEROL VIH'), true);
    assert.equal(isLabSectionHeaderLine('HECES copro'), true);
  });
});

describe('splitResLabsByTipo', () => {
  it('separates labs from cultivo rows', function () {
    var rows = ['BH 12.5 4.1', 'UROCULTIVO: E. COLI', 'ATB S: CIPRO', 'QS 100'];
    var sp = splitResLabsByTipo(rows);
    assert.equal(sp.labs.length, 2);
    assert.equal(sp.cultivo.length, 2);
    assert.match(String(sp.labs[0]), /BH/);
    assert.match(String(sp.cultivo[0]), /UROCULTIVO/);
  });

  it('lab section header ends cultivo block', function () {
    var rows = ['UROCULTIVO: E. COLI', 'BH 12.5'];
    var sp = splitResLabsByTipo(rows);
    assert.equal(sp.cultivo.length, 1);
    assert.equal(sp.labs.length, 1);
  });

  it('SEROL section header ends cultivo block', function () {
    var rows = ['UROCULTIVO: E. COLI', 'ATB S: CIPRO', 'SEROL VIH'];
    var sp = splitResLabsByTipo(rows);
    assert.equal(sp.cultivo.length, 2);
    assert.equal(sp.labs.length, 1);
    assert.match(String(sp.labs[0]), /SEROL/);
  });
});

describe('parseCultureBlockFromLineArray', () => {
  it('parses urocultivo header with germen and cuenta', function () {
    var lines = [
      'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA',
      'ATB R: CAZ | I: FEP | S: CIPRO',
      'Cuenta: +100 UFC',
    ];
    var set = { id: 'set-1', fecha: '07/05/2026', hora: '' };
    var parsed = parseCultureBlockFromLineArray(lines, set, 0);
    assert.equal(parsed.row.organismo, 'PSEUDOMONAS AERUGINOSA');
    assert.match(parsed.row.fechaMuestra, /07\/05/);
    assert.equal(parsed.row.cuenta, '+100 UFC');
    assert.equal(parsed.row.tipoKey, 'otro');
    assert.equal(parsed.row.negativo, false);
  });

  it('detects negative hemocultivo', function () {
    var lines = ['HEMOCULTIVO 01/04: NEGATIVO'];
    var set = { id: 's', fecha: '01/04/2026', hora: '' };
    var parsed = parseCultureBlockFromLineArray(lines, set, 0);
    assert.equal(parsed.row.organismo, 'Negativo');
    assert.equal(parsed.row.negativo, true);
    assert.equal(parsed.row.tipoKey, 'hemo');
  });
});

describe('findCultivoChunkInSet', () => {
  it('finds chunk by organismo query', function () {
    var chunk = [
      'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA',
      'ATB R: CAZ',
      'Cuenta: +100 UFC',
    ].join('\n');
    var set = { id: 'set-1', resLabs: [chunk] };
    var found = findCultivoChunkInSet(set, 'PSEUDOMONAS');
    assert.ok(found);
    assert.match(found, /PSEUDOMONAS AERUGINOSA/);
  });

  it('returns null for empty query', function () {
    assert.equal(findCultivoChunkInSet({ resLabs: ['UROCULTIVO: X'] }, ''), null);
  });
});

describe('isCultureTableHeaderLine', () => {
  it('delegates to parsed cultivo header', function () {
    assert.equal(isCultureTableHeaderLine('UROCULTIVO 01/05: E. COLI'), true);
    assert.equal(isCultureTableHeaderLine('BH 12.5'), false);
  });
});
