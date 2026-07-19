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
globalThis.window = {
  localStorage: mockStorage,
  addEventListener() {},
  removeEventListener() {},
};

const appState = await import('./app-state.mjs');
const {
  ensureParsedLabHistory,
  rebuildEstudiosFromLabHistory,
  labSetIsFromSome,
  groupLabHistoryByDay,
  buildEstudiosCopyLinesFromLabSets,
  resolveEstudiosCopyOptions,
  registerLabHistoryMaintRuntime,
  formatLabHistoryDateSelectLabel,
  primaryTipoForLabSet,
} = await import('./lab-history-set.mjs');

const PATIENT_ID = 'lab-loop-patient';
const SOURCE_TEXT =
  'Expediente: 12345\nFecha Registro: 24/05/2026 02:40\nBH\tHb\t12.1 g/dL\t11-15';

describe('lab-history-set', () => {
  beforeEach(() => {
    store = {};
    appState.setSaveStateHooks({ before: null, after: null });
    appState.setPatients([{ id: PATIENT_ID, nombre: 'Paciente prueba', registro: '12345' }]);
    appState.setNotes({
      [PATIENT_ID]: { estudios: '24/05\nBH\tHb\t12.1 g/dL\t11-15' },
    });
    appState.setLabHistory({
      [PATIENT_ID]: [
        {
          id: '1779633171103',
          fecha: '24/05/2026',
          hora: '01:04',
          resLabs: ['BH\tHb\t12.1 g/dL\t11-15'],
          sourceText: SOURCE_TEXT,
          parsed: { Hb: 12.1 },
          bhExtras: {},
        },
      ],
    });
  });

  it('ensureParsedLabHistory no entra en bucle cuando hora difiere del reporte', () => {
    const history = ensureParsedLabHistory(PATIENT_ID);
    assert.equal(history.length, 1);
    assert.equal(history[0].hora, '02:40');
    assert.equal(appState.labHistory[PATIENT_ID][0].hora, '02:40');
  });

  it('rebuildEstudiosFromLabHistory termina con historial ya normalizado', () => {
    ensureParsedLabHistory(PATIENT_ID);
    rebuildEstudiosFromLabHistory(PATIENT_ID);
    assert.match(String(appState.notes[PATIENT_ID].estudios || ''), /24\/05/);
    assert.equal(appState.labHistory[PATIENT_ID][0].hora, '02:40');
  });

  it('ensureParsedLabHistory readOnly sets fingerprint and skips re-parse', () => {
    const history = ensureParsedLabHistory(PATIENT_ID, { readOnly: true });
    assert.ok(history[0]._parseFingerprint);
    assert.ok(history[0].parsedBySection);
    const fp = history[0]._parseFingerprint;
    const again = ensureParsedLabHistory(PATIENT_ID, { readOnly: true });
    assert.equal(again[0]._parseFingerprint, fp);
  });

  it('ensureParsedLabHistory readOnly does not call saveState', () => {
    let saveCount = 0;
    appState.setSaveStateHooks({
      before: () => {
        saveCount += 1;
      },
    });
    ensureParsedLabHistory(PATIENT_ID, { readOnly: true });
    assert.equal(saveCount, 0);
  });

  it('labSetIsFromSome detecta informe SOME por sourceText', () => {
    assert.equal(
      labSetIsFromSome({ sourceText: SOURCE_TEXT, resLabs: [] }),
      true,
    );
    assert.equal(
      labSetIsFromSome({ sourceText: '02/06\nBH Hb 8.95*', resLabs: [] }),
      false,
    );
  });

  it('formatLabHistoryDateSelectLabel resume fecha y tipo', () => {
    assert.equal(
      formatLabHistoryDateSelectLabel(
        { fecha: '07/06/2026', hora: '08:15', resLabs: ['BH\tHb 12'] },
        function () {
          return '';
        },
        primaryTipoForLabSet,
      ),
      '07/06/2026 08:15 · Labs',
    );
    assert.equal(
      formatLabHistoryDateSelectLabel(
        { fecha: '07/06/2026', resLabs: ['CULTIVO\tUrocultivo negativo'] },
        function () {
          return '';
        },
        primaryTipoForLabSet,
      ),
      '07/06/2026 · Cultivo',
    );
  });

  it('resolveEstudiosCopyOptions en interconsulta limita al día más reciente', () => {
    const sets = [
      { id: '1', fecha: '01/06/2026', hora: '08:00', resLabs: ['BH\tHb 10'] },
      { id: '2', fecha: '02/06/2026', hora: '09:00', resLabs: ['BH\tHb 12'] },
    ];
    const interOpts = resolveEstudiosCopyOptions(sets, { appMode: 'interconsulta' });
    const interText = buildEstudiosCopyLinesFromLabSets(sets, interOpts).join('\n');
    assert.match(interText, /Hb 12/);
    assert.doesNotMatch(interText, /Hb 10/);

    const salaOpts = resolveEstudiosCopyOptions(sets, { appMode: 'sala' });
    const salaText = buildEstudiosCopyLinesFromLabSets(sets, salaOpts).join('\n');
    assert.match(salaText, /Hb 10/);
    assert.match(salaText, /Hb 12/);
  });

  it('rebuildEstudiosFromLabHistory en interconsulta deja solo labs recientes', () => {
    registerLabHistoryMaintRuntime({
      getSettings() {
        return { appMode: 'interconsulta' };
      },
    });
    appState.setLabHistory({
      [PATIENT_ID]: [
        {
          id: '1',
          fecha: '20/05/2026',
          hora: '08:00',
          resLabs: ['BH\tHb 10 g/dL'],
          parsed: { Hb: 10 },
          bhExtras: {},
        },
        {
          id: '2',
          fecha: '24/05/2026',
          hora: '02:40',
          resLabs: ['BH\tHb 12.1 g/dL\t11-15'],
          sourceText: SOURCE_TEXT,
          parsed: { Hb: 12.1 },
          bhExtras: {},
        },
      ],
    });
    rebuildEstudiosFromLabHistory(PATIENT_ID);
    const text = String(appState.notes[PATIENT_ID].estudios || '');
    assert.match(text, /12\.1/);
    assert.doesNotMatch(text, /Hb 10/);
  });

  it('groupLabHistoryByDay y buildEstudiosCopyLinesFromLabSets filtran días', () => {
    const sets = [
      { id: '1', fecha: '01/06/2026', hora: '08:00', resLabs: ['BH\tHb 10'] },
      { id: '2', fecha: '01/06/2026', hora: '14:00', resLabs: ['QS\tGlu 100'] },
      { id: '3', fecha: '02/06/2026', hora: '09:00', resLabs: ['BH\tHb 12'] },
    ];
    const groups = groupLabHistoryByDay(sets);
    assert.equal(groups.length, 2);
    assert.equal(groups[1].sets.length, 2);
    const dk = groups[1].dayKey;
    const lines = buildEstudiosCopyLinesFromLabSets(sets, { onlyDayKeys: [dk] });
    const text = lines.join('\n');
    assert.match(text, /Hb 10/);
    assert.match(text, /Glu 100/);
    assert.match(text, /01\/06 08:00/);
    assert.match(text, /01\/06 14:00/);
    assert.doesNotMatch(text, /Hb 12/);
  });
});
