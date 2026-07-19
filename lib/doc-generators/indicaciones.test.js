'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { generateIndicacionesBuffer } = require('./indicaciones.js');

async function readDocumentXml(buf) {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

describe('generateIndicacionesBuffer', () => {
  it('fills patient header and servicio in table title', async () => {
    const buf = await generateIndicacionesBuffer({
      patient: {
        nombre: 'Paciente Prueba',
        registro: '999',
        edad: '40',
        sexo: 'M',
        area: 'MI',
        servicio: 'Cardiologia',
        cuarto: '101',
        cama: '2',
      },
      indicaciones: {
        fecha: '2026-05-30',
        hora: '08:00',
        medicos: 'Dr. Test',
        descripcion: 'Indicacion de prueba',
        dieta: 'NPO',
        otros: [],
      },
    });

    const xml = await readDocumentXml(buf);

    assert.match(xml, /INDICACIONES POR CARDIOLOG/);
    assert.match(xml, /PACIENTE PRUEBA/);
  });
});
