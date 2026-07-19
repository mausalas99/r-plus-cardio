'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { generateListadoBuffer } = require('./listado.js');

const BASE_PATIENT = {
  nombre: 'TEST',
  registro: '1',
  edad: '1',
  sexo: 'M',
  area: 'MI',
  servicio: 'MI',
  cuarto: '1',
  cama: '1',
};

async function generateDocx(payload) {
  return generateListadoBuffer(payload);
}

function cellTexts(rowXml) {
  const cells = [];
  const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
  let m;
  while ((m = tcRe.exec(rowXml)) !== null) {
    const cellXml = m[1];
    const texts = [];
    const tRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tRe.exec(cellXml)) !== null) {
      texts.push(tm[1]);
    }
    cells.push(texts.join(''));
  }
  return cells;
}

function isProblemRow(rowXml) {
  const texts = cellTexts(rowXml);
  return texts.length === 4 && texts.some((t) => t.includes('TEST'));
}

async function problemRows(docxBytes) {
  const zip = await JSZip.loadAsync(docxBytes);
  const xml = await zip.file('word/document.xml').async('string');
  const rows = [];
  const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let m;
  while ((m = trRe.exec(xml)) !== null) {
    const rowXml = m[0];
    if (isProblemRow(rowXml)) {
      rows.push(cellTexts(rowXml));
    }
  }
  return rows;
}

async function problemRowElements(docxBytes) {
  const zip = await JSZip.loadAsync(docxBytes);
  const xml = await zip.file('word/document.xml').async('string');
  const rows = [];
  const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let m;
  while ((m = trRe.exec(xml)) !== null) {
    const rowXml = m[0];
    if (isProblemRow(rowXml)) {
      rows.push(rowXml);
    }
  }
  return rows;
}

function szValues(rowXml) {
  const sizes = [];
  const re = /<w:sz(?:\s[^>]*)?\sw:val="(\d+)"/g;
  let m;
  while ((m = re.exec(rowXml)) !== null) {
    sizes.push(m[1]);
  }
  return sizes;
}

describe('generateListadoBuffer', () => {
  it('activo e inactivo del mismo indice comparten fila', async () => {
    const docx = await generateDocx({
      patient: BASE_PATIENT,
      listado: {
        activos: [
          {
            fecha: '2026-05-07',
            descripcion: 'ACTIVO TEST\na) detalle',
          },
        ],
        inactivos: [
          {
            fecha: '2026-05-07',
            descripcion: 'INACTIVO TEST\na) detalle',
          },
        ],
      },
      medicos: {},
    });

    const rows = await problemRows(docx);

    assert.equal(rows.length, 1);
    assert.equal(rows[0][1], '1.');
    assert.match(rows[0][2], /ACTIVO TEST/);
    assert.match(rows[0][3], /INACTIVO TEST/);
  });

  it('filas se alinean por indice y solo inactivo aparece solo', async () => {
    const docx = await generateDocx({
      patient: BASE_PATIENT,
      listado: {
        activos: [
          { fecha: '2026-05-07', descripcion: 'ACTIVO TEST UNO' },
        ],
        inactivos: [
          { fecha: '2026-05-07', descripcion: 'INACTIVO TEST UNO' },
          { fecha: '2026-05-07', descripcion: 'INACTIVO TEST DOS' },
        ],
      },
      medicos: {},
    });

    const rows = await problemRows(docx);

    assert.equal(rows.length, 2);
    assert.equal(rows[0][1], '1.');
    assert.match(rows[0][2], /ACTIVO TEST UNO/);
    assert.match(rows[0][3], /INACTIVO TEST UNO/);
    assert.equal(rows[1][1], '2.');
    assert.equal(rows[1][2], '');
    assert.match(rows[1][3], /INACTIVO TEST DOS/);
  });

  it('texto de filas de problemas usa 8 pt', async () => {
    const docx = await generateDocx({
      patient: BASE_PATIENT,
      listado: {
        activos: [
          {
            fecha: '2026-05-07',
            descripcion: 'ACTIVO TEST\na) detalle TEST',
          },
        ],
        inactivos: [],
      },
      medicos: {},
    });

    const row = (await problemRowElements(docx))[0];
    const sizes = szValues(row);

    assert.ok(sizes.length > 0);
    assert.deepEqual(new Set(sizes), new Set(['16']));
  });

  it('filas problema no parten entre paginas cant split', async () => {
    const docx = await generateDocx({
      patient: BASE_PATIENT,
      listado: {
        activos: [
          {
            fecha: '2026-05-07',
            descripcion: 'ACTIVO TEST',
          },
        ],
        inactivos: [],
      },
      medicos: {},
    });

    for (const row of await problemRowElements(docx)) {
      assert.match(row, /<w:trPr>[\s\S]*<w:cantSplit/);
    }
  });
});
