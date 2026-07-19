import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLabRepoFetch } from './fetch-run.mjs';

test('runLabRepoFetch deletes temp PDF after extract', async () => {
  const deleted = [];
  const result = await runLabRepoFetch(
    {
      registro: '2203912-1',
      desde: new Date('2026-06-27T00:00:00'),
      hasta: new Date('2026-06-27T23:59:59'),
    },
    {
      searchByRegistro: async () => ({
        rows: [
        {
          folio: '2606270175',
          fechaSolicitud: '2026-06-27 03:35',
          tipo: 'HEMATOLOGIA',
          departamento: 'LABORATORIO CENTRAL',
          selectEventTarget: 'GridView1',
          selectEventArgument: 'Select$1',
        },
      ],
      }),
      downloadPdfForRow: async () => Buffer.from('%PDF-1.4 fake'),
      fetchReportTextForRow: async () =>
        'Expediente: 2203912-1\nNombre: TEST\nFecha Registro\nHEMATOLOGIA',
      extractText: async () =>
        'Expediente: 2203912-1\nNombre: TEST\nFecha Registro\nHEMATOLOGIA',
      deleteTempFile: (p) => deleted.push(p),
      deleteTempRunDir: () => {},
      createTempRunDir: () => '/tmp/x',
      writeTempPdf: () => '/tmp/x/2606270175.pdf',
    }
  );

  assert.equal(result.studies.length, 1);
  assert.equal(result.studies[0].folio, '2606270175');
  assert.equal(result.studies[0].text.includes('Expediente:'), true);
  assert.equal(deleted.length, 0);
});

test('runLabRepoFetch returns no-rows-in-range when filter empty', async () => {
  const result = await runLabRepoFetch(
    {
      registro: '2203912-1',
      desde: new Date('2026-01-01T00:00:00'),
      hasta: new Date('2026-01-02T00:00:00'),
    },
    {
      searchByRegistro: async () => ({
        rows: [
        {
          folio: '2606270175',
          fechaSolicitud: '2026-06-27 03:35',
          tipo: 'HEMATOLOGIA',
          selectEventTarget: 't',
          selectEventArgument: 'a',
        },
      ],
      }),
      downloadPdfForRow: async () => Buffer.from('%PDF'),
      fetchReportTextForRow: async () => 'Expediente: 1\nNombre: X',
      extractText: async () => 'Expediente: 1\nNombre: X',
      deleteTempFile: () => {},
      deleteTempRunDir: () => {},
      createTempRunDir: () => '/tmp/x',
      writeTempPdf: () => '/tmp/x/1.pdf',
    }
  );

  assert.equal(result.studies.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].message, 'no-rows-in-range');
});

test('runLabRepoFetch returns no-search-results when portal has zero rows', async () => {
  const result = await runLabRepoFetch(
    {
      registro: '9999999-9',
      desde: new Date('2026-06-27T00:00:00'),
      hasta: new Date('2026-06-27T23:59:59'),
    },
    {
      searchByRegistro: async () => ({
        rows: [],
        pageHtml: '<<< SIN COINCIDENCIAS >>>',
      }),
      downloadPdfForRow: async () => Buffer.from('%PDF'),
      fetchReportTextForRow: async () => 'Expediente: 1\nNombre: X',
      extractText: async () => 'Expediente: 1\nNombre: X',
      deleteTempFile: () => {},
      deleteTempRunDir: () => {},
      createTempRunDir: () => '/tmp/x',
      writeTempPdf: () => '/tmp/x/1.pdf',
    }
  );

  assert.equal(result.studies.length, 0);
  assert.equal(result.errors[0].message, 'no-search-results');
});
