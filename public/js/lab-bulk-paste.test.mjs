import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
const mockStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});
globalThis.window = { localStorage: mockStorage };

const {
  LAB_BULK_PATIENT_SEPARATOR,
  isLabBulkPatientSeparatorLine,
  splitBulkLabTextByPatient,
  splitSomeReportsInBlock,
  buildBulkLabPreview,
  mergeBulkParseResults,
  mergeBulkParseResultsForStorage,
  pickLatestDayMergedLabDisplay,
  shouldShowBulkLabPreview,
  extractLabPatientFromBulkBlock,
} = await import('./lab-bulk-paste.mjs');
const { procesarLabs } = await import('./labs.js');
const { primaryTipoForLabSet, isGasometriaOnlyResLabs } = await import('./lab-history-format.mjs');
const { GASO_VENOSA_SOLO } = await import('./labs-procesar-fixtures.mjs');
const { DEMO_SOME_LAB_REPORT, OLDER_DEMO_SOME_LAB_REPORT } = await import('./tour-demo-some-lab.mjs');

function primaryTipoForResLabs(resLabs) {
  return primaryTipoForLabSet(resLabs);
}

describe('lab-bulk-paste', () => {
  beforeEach(() => {
    store = {};
  });

  it('isLabBulkPatientSeparatorLine reconoce separador de paciente', () => {
    assert.equal(isLabBulkPatientSeparatorLine('--- PACIENTE ---'), true);
    assert.equal(isLabBulkPatientSeparatorLine('  --- paciente ---  '), true);
    assert.equal(isLabBulkPatientSeparatorLine('--- PACIENTE --- extra'), false);
  });

  it('splitBulkLabTextByPatient parte bloques por separador', () => {
    var text =
      DEMO_SOME_LAB_REPORT +
      '\n' +
      LAB_BULK_PATIENT_SEPARATOR +
      '\n' +
      OLDER_DEMO_SOME_LAB_REPORT.replace('0008421-7', '1111111-1');
    var blocks = splitBulkLabTextByPatient(text);
    assert.equal(blocks.length, 2);
    assert.match(blocks[0], /0008421-7/);
    assert.match(blocks[1], /1111111-1/);
  });

  it('splitSomeReportsInBlock separa varios reportes SOME', () => {
    var block = DEMO_SOME_LAB_REPORT + '\n\n' + OLDER_DEMO_SOME_LAB_REPORT;
    var reports = splitSomeReportsInBlock(block);
    assert.equal(reports.length, 2);
    assert.match(reports[0], /Apr 11 2026/);
    assert.match(reports[1], /Mar 05 2026/);
  });

  it('splitSomeReportsInBlock tolera espacio antes de Expediente:', () => {
    var glued =
      'LIPASA SERICA\t1244 U/L 8 - 57\n Expediente:\t1111111-1\tSolicitud:\t1\nNombre:\tDemo';
    var reports = splitSomeReportsInBlock(glued);
    assert.equal(reports.length, 2);
    assert.match(reports[1], /1111111-1/);
  });

  it('pickLatestDayMergedLabDisplay consolida solo el día más reciente', () => {
    var block = DEMO_SOME_LAB_REPORT + '\n\n' + OLDER_DEMO_SOME_LAB_REPORT;
    var items = splitSomeReportsInBlock(block)
      .map(function (text) {
        return { result: procesarLabs(text), reportText: text };
      })
      .filter(function (item) {
        return item.result.resLabs && item.result.resLabs.length;
      });
    var display = pickLatestDayMergedLabDisplay(items);
    assert.ok(display);
    assert.match(display.fecha || display.patient.fecha, /04\/11\/2026|11\/04\/2026/);
    assert.ok(
      display.resLabs.some(function (row) {
        return /^QS\b/i.test(String(row));
      }),
      'debe incluir química del día reciente'
    );
    var perDaySets = mergeBulkParseResults(items);
    assert.equal(perDaySets.length, 2, 'varios días en historial: un conjunto por día, sin fusionar');
  });

  it('mergeBulkParseResults consolida mismo día si están a ≤2 h', () => {
    var dupDay = DEMO_SOME_LAB_REPORT.replace('9:42AM', '10:15AM');
    var items = [DEMO_SOME_LAB_REPORT, dupDay].map(function (text) {
      return { result: procesarLabs(text), reportText: text };
    });
    var merged = mergeBulkParseResults(items);
    assert.equal(merged.length, 1);
    assert.ok(merged[0].resLabs.length > 0);
  });

  it('mergeBulkParseResults mantiene cada gasometría seriada del mismo día', () => {
    var gasoA = GASO_VENOSA_SOLO.replace('6:43AM', '6:43AM');
    var gasoB = GASO_VENOSA_SOLO.replace('6:43AM', '7:30AM').replace('7.39', '7.35');
    var items = [gasoA, gasoB].map(function (text) {
      return { result: procesarLabs(text), reportText: text };
    });
    assert.ok(isGasometriaOnlyResLabs(items[0].result.resLabs));
    assert.equal(primaryTipoForResLabs(items[0].result.resLabs), 'gaso');
    var merged = mergeBulkParseResults(items);
    assert.equal(merged.length, 2, 'cada gasometría seriada debe quedar como conjunto propio');
  });

  it('mergeBulkParseResults une labs + gasometría inicial del mismo día', () => {
    var labs = DEMO_SOME_LAB_REPORT.replace('Apr 11 2026 9:42AM', 'Apr 11 2026 8:00AM');
    var gaso = GASO_VENOSA_SOLO.replace('May 7 2026 6:43AM', 'Apr 11 2026 8:15AM');
    var items = [labs, gaso].map(function (text) {
      return { result: procesarLabs(text), reportText: text };
    });
    var merged = mergeBulkParseResults(items);
    assert.equal(merged.length, 1);
    assert.ok(
      merged[0].resLabs.some(function (row) {
        return /^GASES\b/i.test(String(row));
      })
    );
    assert.ok(
      merged[0].resLabs.some(function (row) {
        return /^BH\b/i.test(String(row));
      })
    );
    var gasesLine = merged[0].resLabs.find(function (row) {
      return /^GASES\b/i.test(String(row));
    });
    assert.ok(gasesLine, 'debe incluir línea GASES');
    assert.match(String(gasesLine), /\bAG \d/, 'debe calcular anión gap al fusionar labs + gasometría');
  });

  it('mergeBulkParseResultsForStorage un solo conjunto por día (repo gaso + química)', () => {
    var labs = DEMO_SOME_LAB_REPORT.replace('Apr 11 2026 9:42AM', 'Apr 11 2026 9:56AM');
    var gasoA = GASO_VENOSA_SOLO.replace('May 7 2026 6:43AM', 'Apr 11 2026 9:56AM');
    var gasoB = GASO_VENOSA_SOLO
      .replace('May 7 2026 6:43AM', 'Apr 11 2026 9:58AM')
      .replace('7.39', '7.35');
    var items = [gasoA, labs, gasoB].map(function (text) {
      return { result: procesarLabs(text), reportText: text };
    });
    var clustered = mergeBulkParseResults(items);
    assert.ok(clustered.length >= 2, 'cluster horario puede partir gasometrías seriadas');
    var stored = mergeBulkParseResultsForStorage(items);
    assert.equal(stored.length, 1, 'historial: un conjunto por día calendario');
    assert.ok(
      stored[0].resLabs.some(function (row) {
        return /^BH\b/i.test(String(row));
      })
    );
    assert.ok(
      stored[0].resLabs.some(function (row) {
        return /^GASES\b/i.test(String(row));
      })
    );
  });

  it('mergeBulkParseResults mantiene días distintos separados', () => {
    var block = DEMO_SOME_LAB_REPORT + '\n\n' + OLDER_DEMO_SOME_LAB_REPORT;
    var preview = buildBulkLabPreview(block, { findPatientByRegistro: function () { return null; } });
    assert.equal(preview[0].reports.filter(function (r) { return r.ok; }).length, 2);
    var items = preview[0].reports
      .filter(function (r) {
        return r.ok;
      })
      .map(function (r) {
        return { result: r.result, reportText: r.reportText };
      });
    var merged = mergeBulkParseResults(items);
    assert.equal(merged.length, 2);
    var fechas = merged.map(function (m) {
      return m.fecha;
    });
    assert.notEqual(fechas[0], fechas[1]);
  });

  it('buildBulkLabPreview detecta paciente por expediente', () => {
    var block = DEMO_SOME_LAB_REPORT + '\n\n' + OLDER_DEMO_SOME_LAB_REPORT;
    var preview = buildBulkLabPreview(block, {
      findPatientByRegistro: function (reg) {
        if (reg === '0008421-7') return { id: 'p1', nombre: 'Demo Pérez', registro: '0008421-7' };
        return null;
      },
    });
    assert.equal(preview.length, 1);
    assert.equal(preview[0].status, 'ok');
    assert.equal(preview[0].patient.id, 'p1');
    assert.equal(preview[0].okReportCount, 2);
    assert.equal(preview[0].setsAfterMerge, 2);
    assert.ok(preview[0].days.length >= 2);
  });

  it('extractLabPatientFromBulkBlock toma datos del primer reporte válido', () => {
    var preview = buildBulkLabPreview(DEMO_SOME_LAB_REPORT, {
      findPatientByRegistro: function () {
        return null;
      },
    });
    var patient = extractLabPatientFromBulkBlock(preview[0]);
    assert.ok(patient);
    assert.match(String(patient.name || ''), /PÉREZ|PEREZ/i);
    assert.equal(patient.expediente, '0008421-7');
  });

  it('primaryTipoForResLabs clasifica cultivo con encabezado de sitio en mayúsculas', () => {
    var resLabs = [
      'LIQUIDO PERITONEAL 07/05: PSEUDOMONAS AERUGINOSA',
      'ATB R: CAZ',
      'Cuenta: +100 UFC',
    ];
    assert.equal(primaryTipoForResLabs(resLabs), 'cultivo');
  });

  it('primaryTipoForResLabs clasifica mixed cuando hay labs y cultivo con SEROL', () => {
    var resLabs = [
      'BH 12.5 4.1',
      'UROCULTIVO: E. COLI',
      'ATB S: CIPRO',
      'SEROL VIH negativo',
    ];
    assert.equal(primaryTipoForResLabs(resLabs), 'mixed');
  });

  it('shouldShowBulkLabPreview abre modal con varios reportes o avisos', () => {
    assert.equal(shouldShowBulkLabPreview([{ status: 'ok' }], 1), false);
    assert.equal(shouldShowBulkLabPreview([{ status: 'ok' }], 2), true);
    assert.equal(
      shouldShowBulkLabPreview(
        [
          { status: 'ok' },
          { status: 'ok' },
        ],
        2
      ),
      true
    );
    assert.equal(shouldShowBulkLabPreview([{ status: 'no-patient' }], 1), true);
    assert.equal(
      shouldShowBulkLabPreview([{ status: 'no-patient', okReportCount: 1 }], 1, { quickLabOutput: true }),
      false
    );
    assert.equal(
      shouldShowBulkLabPreview(
        [{ status: 'no-patient', okReportCount: 2 }],
        2,
        { quickLabOutput: true }
      ),
      false
    );
    assert.equal(
      shouldShowBulkLabPreview(
        [
          { status: 'no-patient', okReportCount: 1 },
          { status: 'no-patient', okReportCount: 1 },
        ],
        2,
        { quickLabOutput: true }
      ),
      false
    );
    assert.equal(
      shouldShowBulkLabPreview(
        [{ status: 'ok', okReportCount: 2, canProcess: true, patient: { id: 'p1' } }],
        2,
        { quickLabOutput: true }
      ),
      true
    );
  });
});
