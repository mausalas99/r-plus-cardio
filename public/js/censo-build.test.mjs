import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortPatientsForCensus, formatCensusMonthLabel, truncateCensusCell, buildCensusPayload, formatPacienteMetaForCenso, formatCamaCellForCenso, formatPatientNameForCenso } from './censo-build.mjs';

test('formatCamaCellForCenso cuarto solo si cama 0 o vacía', () => {
  assert.equal(formatCamaCellForCenso({ cuarto: '201', cama: '0' }), '201');
  assert.equal(formatCamaCellForCenso({ cuarto: '211', cama: '01' }), '211-1');
  assert.equal(formatCamaCellForCenso({ cuarto: '433', cama: '07' }), '433-7');
  assert.equal(formatCamaCellForCenso({ cuarto: '305', cama: '' }), '305');
});

test('formatPatientNameForCenso conserva nombre completo', () => {
  assert.equal(formatPatientNameForCenso('GARCIA LOPEZ JUAN CARLOS'), 'GARCIA LOPEZ JUAN CARLOS');
  assert.equal(formatPatientNameForCenso('  MARIA  '), 'MARIA');
  assert.equal(formatPatientNameForCenso(''), '—');
});

test('buildCensusPayload usa nombre completo del paciente', () => {
  var payload = buildCensusPayload({
    settings: {},
    patients: [{ id: '1', nombre: 'PEREZ SOTO ANA', archived: false }],
    includeArchived: false,
    labHistoryByPatient: { 1: [] },
    medRecetaByPatient: {},
    todosByPatient: { 1: [] },
  });
  assert.equal(payload.rows[0].pacienteNombre, 'PEREZ SOTO ANA');
});

test('formatPacienteMetaForCenso líneas sin sexo', () => {
  assert.equal(
    formatPacienteMetaForCenso({ registro: '123', edad: '54', sexo: 'M' }),
    '123\n54 años'
  );
});

test('formatPacienteMetaForCenso FIUX y FIMI debajo de edad', () => {
  var meta = formatPacienteMetaForCenso(
    {
      registro: '998',
      edad: '60',
      fiuxFecha: '2026-05-20',
      fimiFecha: '2026-05-22',
    },
    { censoFimiLabel: 'MI' }
  );
  var lines = meta.split('\n');
  assert.equal(lines[0], '998');
  assert.equal(lines[1], '60 años');
  assert.equal(lines[2], 'FIUX: 20/05/2026');
  assert.equal(lines[3], 'MI: 22/05/2026');
});

test('sortPatientsForCensus ordena por cuarto', () => {
  var sorted = sortPatientsForCensus([
    { id: 'b', nombre: 'B', cuarto: '305', cama: '1' },
    { id: 'a', nombre: 'A', cuarto: '201', cama: '2' },
  ]);
  assert.equal(sorted[0].id, 'a');
});

test('formatCensusMonthLabel español', () => {
  var label = formatCensusMonthLabel(new Date(2026, 4, 29));
  assert.match(label, /MAYO\s+2026/i);
});

test('truncateCensusCell añade elipsis', () => {
  assert.equal(truncateCensusCell('abcdef', 4), 'abc…');
});

test('buildCensusPayload usa censoMedsText y dx del paciente', () => {
  var payload = buildCensusPayload({
    settings: {
      profesorName: 'Dr. P',
      residenteR2: 'R2 X',
      residenteR1a: 'R1 A',
      defaultServicio: 'ONCO',
      censoSala: '1',
    },
    patients: [
      {
        id: '1',
        nombre: 'TEST',
        registro: '123',
        edad: '50',
        sexo: 'M',
        cuarto: '201',
        cama: '1',
        archived: false,
        diagnosticosList: ['DM2'],
        censoMedsText: 'MEROPENEM · Día 2',
      },
    ],
    includeArchived: false,
    labHistoryByPatient: { 1: [] },
    medRecetaByPatient: {},
    todosByPatient: { 1: [{ text: 'BH mañana', completed: false }] },
    now: new Date(2026, 4, 29),
  });
  assert.equal(payload.rows.length, 1);
  var sections = payload.rows[0].sections || [];
  var dx = sections.find((s) => s.label === 'Diagnósticos');
  var meds = sections.find((s) => s.label === 'ATB / Medicamentos');
  var pend = sections.find((s) => s.label === 'Pendientes');
  assert.match(dx.lines.join(' '), /DM2/);
  assert.match(meds.lines.join(' '), /MEROPENEM/);
  assert.match(pend.lines.join(' '), /BH/i);
  assert.equal(payload.header.r2, 'R2 X');
  assert.equal(payload.header.titleLine, 'Censo de Sala 1');
  assert.match(payload.header.equipoLine, /R2 X/);
  assert.match(payload.header.equipoLine, /Dr\. P/);
  assert.doesNotMatch(payload.header.equipoLine, /R2:/);
});

test('buildCensusPayload accesos múltiples en celda', () => {
  var payload = buildCensusPayload({
    settings: {},
    patients: [
      {
        id: '1',
        nombre: 'T',
        archived: false,
        accesosList: [
          { via: 'cvc', fecha: '2026-05-01' },
          { via: 'picc', fecha: '2026-05-12' },
        ],
      },
    ],
    includeArchived: false,
    labHistoryByPatient: { 1: [] },
    medRecetaByPatient: {},
    todosByPatient: { 1: [] },
  });
  var acc = (payload.rows[0].sections || []).find((s) => s.label === 'Accesos');
  assert.ok(acc);
  var joined = acc.lines.join('\n');
  assert.match(joined, /CVC/);
  assert.match(joined, /PICC/);
});

test('buildCensusPayload fallback meds desde receta', () => {
  var payload = buildCensusPayload({
    settings: {},
    patients: [{ id: '1', nombre: 'T', archived: false, diagnosticosList: ['X'] }],
    includeArchived: false,
    labHistoryByPatient: { 1: [] },
    medRecetaByPatient: {
      1: {
        items: [
          {
            nombreRaw: 'Vancomicina 1g',
            viaRaw: 'IV',
            frecuenciaRaw: 'c/12h',
            diaTratamiento: 1,
            suspendido: false,
          },
        ],
      },
    },
    todosByPatient: { 1: [] },
  });
  var medSec = (payload.rows[0].sections || []).find((s) => s.label === 'ATB / Medicamentos');
  assert.match(medSec.lines.join(' '), /VANCOMICINA/i);
});

test('buildCensusPayload labs con resultados completos del último set', () => {
  var payload = buildCensusPayload({
    settings: {},
    patients: [{ id: '1', nombre: 'T', archived: false, diagnosticosList: ['X'] }],
    includeArchived: false,
    labHistoryByPatient: {
      1: [
        {
          fecha: '29/05/2026',
          resLabs: ['BH\nHb 5.8* g/dL\nHto 18* %', 'QS\nGlu 145 mg/dL'],
        },
      ],
    },
    medRecetaByPatient: {},
    todosByPatient: { 1: [] },
  });
  var labSec = (payload.rows[0].sections || []).find((s) => s.label === 'Laboratorios');
  assert.ok(labSec);
  var joined = labSec.lines.join('\n');
  assert.match(joined, /29\/05\/2026/);
  assert.match(joined, /Hb 5\.8/);
  assert.match(joined, /Glu 145/);
  assert.match(payload.rows[0].labs, /Hto 18/);
});

test('buildCensusPayload pendientes — max 3 alta, sin mezclar media', () => {
  var payload = buildCensusPayload({
    settings: {},
    patients: [{ id: '1', nombre: 'T', archived: false, diagnosticosList: ['X'] }],
    includeArchived: false,
    labHistoryByPatient: { 1: [] },
    medRecetaByPatient: {},
    todosByPatient: {
      1: [
        { text: 'Alta A', completed: false, priority: 'alta' },
        { text: 'Alta B', completed: false, priority: 'alta' },
        { text: 'Alta C', completed: false, priority: 'alta' },
        { text: 'Alta D', completed: false, priority: 'alta' },
        { text: 'Media X', completed: false, priority: 'media' },
      ],
    },
  });
  var pend = (payload.rows[0].sections || []).find((s) => s.label === 'Pendientes');
  assert.ok(pend);
  assert.equal(pend.lines.length, 3);
  assert.deepEqual(pend.lines, ['Alta A', 'Alta B', 'Alta C']);
});

test('buildCensusPayload pendientes — sin alta usa media', () => {
  var payload = buildCensusPayload({
    settings: {},
    patients: [{ id: '1', nombre: 'T', archived: false, diagnosticosList: ['X'] }],
    includeArchived: false,
    labHistoryByPatient: { 1: [] },
    medRecetaByPatient: {},
    todosByPatient: {
      1: [
        { text: 'Media 1', completed: false, priority: 'media' },
        { text: 'Baja 1', completed: false, priority: 'baja' },
      ],
    },
  });
  var pend = (payload.rows[0].sections || []).find((s) => s.label === 'Pendientes');
  assert.deepEqual(pend.lines, ['Media 1']);
});
