import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSOAPText } from './soap-estado.mjs';

/** @type {Map<string, { value: string }>} */
var fields = new Map();

function stubDocument() {
  return {
    getElementById(id) {
      if (!fields.has(id)) fields.set(id, { value: '' });
      return fields.get(id);
    },
    createElement() {
      return { value: '' };
    },
    body: { appendChild() {} },
  };
}

function setSoapField(id, value) {
  fields.set(id, { value: String(value) });
}

test('buildSOAPText NM suplemento sin requerimiento calórico', () => {
  fields = new Map();
  var priorDoc = globalThis.document;
  globalThis.document = stubDocument();
  try {
    [
      'soap-four',
      'soap-esferas',
      'soap-analgesia',
      'soap-fr',
      'soap-sat',
      'soap-tas',
      'soap-tad',
      'soap-fc',
      'soap-antihta',
      'soap-antitromboticos',
      'soap-vasop',
      'soap-temp',
      'soap-abx',
      'soap-dieta',
      'soap-kcalkg',
      'soap-kcal',
      'soap-ing',
      'soap-egr',
      'soap-glu1',
      'soap-glu2',
      'soap-glu3',
    ].forEach(function (id) {
      setSoapField(id, '');
    });
    setSoapField('soap-dieta', 'SUPLEMENTO');
    setSoapField('soap-kcalkg', '25');
    setSoapField('soap-kcal', '1750');
    setSoapField('soap-ing', '500');
    setSoapField('soap-egr', '300');

    var text = buildSOAPText();
    var nmLine = text.split('\n').find(function (line) {
      return line.startsWith('NM:');
    });
    assert.match(nmLine, /^NM: DIETA SUPLEMENTO \|\| INGRESOS/);
    assert.doesNotMatch(nmLine, /CALCULADA A/);
    assert.doesNotMatch(nmLine, /KCAL\/KG/);
  } finally {
    globalThis.document = priorDoc;
  }
});
