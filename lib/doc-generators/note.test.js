'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { generateNoteBuffer } = require('./note.js');

async function readDocumentXml(buf) {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

describe('generateNoteBuffer', () => {
  it('fills fecha and uppercased patient nombre in document xml', async () => {
    const buf = await generateNoteBuffer({
      patient: {
        nombre: 'Juan Test',
        registro: '123',
        edad: '50',
        sexo: 'M',
        area: 'MI',
        servicio: 'MI',
        cuarto: '1',
        cama: '1',
      },
      note: {
        fecha: '15/05/2026',
        hora: '14:30',
        interrogatorio: 'Paciente estable.',
        evolucion: 'N: sin cambios',
        estudios: '',
        diagnosticos: ['DX UNO'],
        ta: '120/80',
        fr: '18',
        fc: '70',
        temp: '36.5',
        peso: '70',
        tratamiento: ['Paracetamol'],
        medico: 'Dr. Test',
        profesor: 'Dr. Prof',
      },
    });

    const xml = await readDocumentXml(buf);

    assert.match(xml, /15\/05\/2026/);
    assert.match(xml, /JUAN TEST/);
  });
});
