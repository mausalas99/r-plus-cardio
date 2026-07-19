'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { generateIcHojaBuffer } = require('./ic-hoja.js');
const { fillIcHojaXml, ORIG } = require('./ic-hoja-xml-fill.js');

async function readDocumentXml(buf) {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

describe('fillIcHojaXml / generateIcHojaBuffer', () => {
  it('replaces identity + day/score sentinels documented from the template', () => {
    // Sentinels replaced (minimum set documented for Task 10):
    //   ORIG.nombreLine, ORIG.registroLine, ORIG.diasInternamiento,
    //   ORIG.vexus, ORIG.congestion — plus many Ma.Elena narrative/lab/med strings.
    const xml = [
      `<w:t>${ORIG.nombreLine}</w:t>`,
      `<w:t>${ORIG.registroLine}</w:t>`,
      `<w:t>${ORIG.diasInternamiento}</w:t>`,
      `<w:t>${ORIG.vexus}</w:t>`,
      `<w:t xml:space="preserve">${ORIG.congestion}</w:t>`,
    ].join('');

    const out = fillIcHojaXml(xml, {
      nombre: 'Juan Prueba',
      registro: '1111111-1',
      diasInternamiento: 3,
      vexus: 1,
      congestionScore: 2,
    });

    assert.match(out, /Nombre: Juan Prueba /);
    assert.match(out, /Registro: 1111111-1/);
    assert.match(out, /Días de internamiento 3/);
    assert.match(out, /VExUS Score \(Especificar\):  1/);
    assert.match(out, /CONGESTION Score \(Especificar\): 2 /);
    assert.doesNotMatch(out, /Ma\. Elena Contreras Alvarado/);
    assert.doesNotMatch(out, /0893295-0/);
  });

  it('round-trip: output is zip; registro filled; original sentinel gone', async () => {
    const buf = await generateIcHojaBuffer({
      payload: {
        nombre: 'Paciente Test IC',
        registro: '9999999-9',
        edad: '55',
        ingresoDisplay: '01/01/2026',
        fechaDisplay: '19/03/2026',
        diasInternamiento: 4,
        diasDescongestion: 3,
        inicioDescongestionDisplay: '16/03/2026',
        vexus: 2,
        congestionScore: 1,
        usPulmonar: 'Patrón B',
        stevenson: 'B',
        antecedentesLines: ['Antecedente de prueba.'],
        peeaLines: ['PEEA de prueba.'],
        pocusLines: ['19.03.26 VExUS 2 congestion 1'],
        eventosLines: ['19.03.26 Evento de prueba'],
        labsLines: ['PH: 7.40'],
        diagnosticos: ['IC descompensada'],
        checklist: {},
      },
    });

    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 1000);
    const xml = await readDocumentXml(buf);
    assert.match(xml, /9999999-9/);
    assert.match(xml, /Paciente Test IC/);
    assert.match(xml, /Días de internamiento 4/);
    assert.match(xml, /VExUS Score \(Especificar\):  2/);
    assert.doesNotMatch(xml, /0893295-0/);
    assert.doesNotMatch(xml, /Ma\. Elena Contreras Alvarado/);
  });

  it('fills medCells into cleared template med sentinels', () => {
    const xml = [
      '<w:t>Neparvis</w:t>',
      '<w:t>Dapagliflozina</w:t>',
      '<w:t>Bisoprolol</w:t>',
      '<w:t>10 mg c/24h</w:t>',
      '<w:t>2.5 mg c/24h</w:t>',
    ].join('');
    const medCells = Array(20).fill('');
    medCells[0] = 'Dapagliflozina';
    medCells[1] = 'Empagliflozina';
    medCells[9] = '10 mg c/24h';
    medCells[10] = '25 mg';
    const out = fillIcHojaXml(xml, { medCells });
    assert.match(out, /Dapagliflozina/);
    assert.match(out, /Empagliflozina/);
    assert.match(out, /25 mg/);
    assert.doesNotMatch(out, /Neparvis/);
    assert.doesNotMatch(out, /Bisoprolol/);
  });
});
