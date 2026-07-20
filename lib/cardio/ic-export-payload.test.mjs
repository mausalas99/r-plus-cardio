import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcExportPayload, formatDisplayDate, formatShortDate } from './ic-export-payload.mjs';

describe('buildIcExportPayload', () => {
  it('maps Ma.Elena-shaped fixture: identity, days, VExUS/congestion as-of, events', () => {
    const patient = {
      nombre: 'Ma. Elena Contreras Alvarado',
      registro: '0893295-0',
      edad: '79',
      fimiFecha: '2026-03-13',
      fenotipo: 'Fenotipo de HFpEF',
      etiologia: 'IC FEVIpreservada',
      historiaClinica: {
        padecimientoActual: 'Inicia padecimiento actual 5 días previo a ingreso.',
        app: {
          descripcionDetallada: 'EPOC diagnosticado hace 15 años.\nApnea Obstructiva del Sueño.',
        },
      },
      diagnosticos: [
        'Insuficiencia Cardiaca FEVI preservada',
        'Exacerbación EPOC',
      ],
      eventualidades: {
        entries: [
          { at: '2026-03-14T12:00:00.000Z', text: 'Respuesta a diurético; IC Neumología.' },
          { at: '2026-03-19T12:00:00.000Z', text: 'Alta planificada; cita IC en 7 días.' },
        ],
      },
      cardio: {
        inicioDescongestion: '2026-03-13',
        overrides: { diuresisAcumuladaMl: 17245, furosemidaAcumuladaMg: 800 },
        pocusByDay: [
          {
            date: '2026-03-13',
            vciCm: 2.8,
            vexus: 2,
            congestionScore: 3,
            lungPattern: 'B',
            note: 'VCI 2.8; VExUS 2; congestion 3',
          },
          {
            date: '2026-03-19',
            vciCm: 1.63,
            vexus: 0,
            congestionScore: 0,
            lungPattern: 'A',
            stevenson: 'A',
            checklist: {
              pvy: false,
              rhy: false,
              edemaMi: false,
              llenadoCapilar: '3',
            },
          },
        ],
        diureticSegments: [
          { id: 'd1', tipo: 'Furosemida', inicio: '2026-03-13', dosis: '80 mg DU bolo', mgTotal: 80 },
          {
            id: 'd2',
            tipo: 'Furosemida',
            inicio: '2026-03-19',
            dosis: '40 mg VO cada 12 horas',
            mgTotal: 80,
          },
        ],
        fantasticos: [],
        medSegments: [],
        medCatalog: [],
      },
      icLabs: [{ date: '2026-03-13', lines: ['PH: 7.30 PCO2: 60'] }],
      monitoreo: {
        historial: [
          {
            recordedAt: '2026-03-19T15:00:00.000Z',
            vitals: { tas: 120, tad: 70, fc: 60, fr: 18, sat: 93, temp: 36.5 },
            io: { diuresis: 1780 },
          },
        ],
      },
    };

    const payload = buildIcExportPayload(patient, { asOfDate: '2026-03-19' });

    assert.equal(payload.nombre, 'Ma. Elena Contreras Alvarado');
    assert.equal(payload.registro, '0893295-0');
    assert.equal(payload.edad, '79');
    assert.equal(payload.ingresoDisplay, '13/03/2026');
    assert.equal(payload.fechaDisplay, formatDisplayDate('2026-03-19'));
    assert.equal(payload.diasInternamiento, 7);
    assert.equal(payload.diasDescongestion, 7);
    assert.equal(payload.vexus, 0);
    assert.equal(payload.congestionScore, 0);
    assert.equal(payload.stevenson, 'A');
    assert.equal(payload.usPulmonar, 'A');
    assert.ok(payload.vitalsLine.includes('120/70'));
    assert.ok(payload.diuresisAcumuladaDisplay.includes('17,245'));
    assert.ok(payload.furosemidaAcumuladaDisplay.includes('800'));
    assert.equal(payload.antecedentesLines.length, 2);
    assert.ok(payload.peeaLines[0].includes('padecimiento'));
    assert.equal(payload.eventosLines.length, 2);
    assert.ok(payload.eventosLines[0].startsWith(formatShortDate('2026-03-14')));
    assert.ok(payload.pocusLines.length >= 2);
    assert.ok(payload.labsLines.includes('13.03.26') || payload.labsLines.some((l) => /PH/.test(l)));
    assert.deepEqual(payload.diagnosticos.slice(0, 2), [
      'Insuficiencia Cardiaca FEVI preservada',
      'Exacerbación EPOC',
    ]);
  });

  it('maps labHistory text dump and medCells from fantasticos / medSegments', () => {
    const patient = {
      labHistory: [
        { fecha: '2026-03-15', resLabs: ['HB: 11.0 HTO: 36'] },
      ],
      cardio: {
        fantasticos: [
          { className: 'SGLT2i', drug: 'Dapagliflozina', dosis: '10 mg c/24h' },
        ],
        medSegments: [
          {
            id: 'm1',
            tipo: 'Prednisona',
            dosis: '40 mg cada 24h',
            indicacion: 'Exacerbación',
            endedAt: null,
          },
        ],
        diureticSegments: [],
      },
    };
    const payload = buildIcExportPayload(patient, { asOfDate: '2026-03-19' });
    assert.ok(payload.labsLines.some((l) => /HB: 11\.0/.test(l)));
    assert.ok(payload.medCells.includes('Dapagliflozina'));
    assert.ok(payload.medCells.includes('Prednisona'));
    assert.ok(payload.medCells.includes('10 mg c/24h'));
    assert.ok(payload.medExtra.indicacionesExtra.includes('Exacerbación'));
    assert.equal(payload.medExtra.furosemidaName, '');
  });

  it('reads diuresis from egrParts / egr when legacy diuresis is absent', () => {
    const patient = {
      monitoreo: {
        historial: [
          {
            recordedAt: '2026-03-19T15:00:00.000Z',
            vitals: { tas: 110, tad: 70, fc: 72 },
            io: { egrParts: [{ kind: 'diuresis', label: 'Diuresis', value: 1500 }] },
          },
        ],
      },
      cardio: { inicioDescongestion: '2026-03-19' },
    };
    const payload = buildIcExportPayload(patient, { asOfDate: '2026-03-19' });
    assert.equal(payload.diuresis24hDisplay, ' 1500 CC');
  });

  it('maps soplo/estertores booleans into checklist for export', () => {
    const patient = {
      cardio: {
        pocusByDay: [
          {
            date: '2026-03-19',
            checklist: { soplo: false, estertores: true, soploNota: '', estertoresNota: '' },
          },
        ],
      },
    };
    const payload = buildIcExportPayload(patient, { asOfDate: '2026-03-19' });
    assert.equal(payload.checklist.soplo, false);
    assert.equal(payload.checklist.estertores, true);
  });

  it('empty patient yields blank-safe defaults without throwing', () => {
    const payload = buildIcExportPayload({}, { asOfDate: '2026-03-19' });
    assert.equal(payload.nombre, '');
    assert.equal(payload.registro, '');
    assert.equal(payload.diasInternamiento, 0);
    assert.equal(payload.vexus, null);
    assert.equal(payload.congestionScore, null);
    assert.deepEqual(payload.eventosLines, []);
    assert.deepEqual(payload.labsLines, []);
  });
});
