import { buildTourDemoListadoProblemas } from './tour-demo-listado-problemas.mjs';
import { normalizeRecetaHuDraft } from './receta-hu-core.mjs';
import { bumpLabHistoryRevision } from './lab-history-cache.mjs';
import { PITCH_DEMO_PATIENT_ID } from './tour-pitch-sandbox.mjs';
import { buildPitchMonitoreoHistorial } from './tour-pitch-monitoreo.mjs';
import { buildPitchLabHistoryEntries } from './tour-pitch-labs.mjs';

/** @param {Date} today */
export function buildPitchDemoPatient(today) {
  return {
    id: PITCH_DEMO_PATIENT_ID,
    nombre: 'DEMO PÉREZ',
    registro: '0008421-7',
    edad: '67 años',
    sexo: 'M',
    area: 'SERVICIO DEMO',
    servicio: 'SERVICIO DEMO',
    cuarto: '101',
    cama: '1',
    fromLab: false,
    isDemo: true,
    monitoreo: buildPitchMonitoreoHistorial(today),
  };
}

/**
 * @param {Record<string, unknown>} maps
 * @param {string} fecha
 * @param {string} hora
 */
export function fillPitchDemoClinicalMaps(maps, fecha, hora) {
  const { notes, indicaciones, labHistory, listadoProblemas } = maps;

  notes[PITCH_DEMO_PATIENT_ID] = {
    fecha,
    hora,
    interrogatorio: '',
    evolucion:
      'Paciente masculino de 67 años con peritonitis asociada a diálisis peritoneal en manejo antibiótico. ' +
      'Hemodinámicamente estable, afebril en el turno. Continúa monitoreo de glucometrías y balance hídrico.',
    estudios: 'Cultivos con aislamientos documentados; ver pestaña Cultivos.',
    diagnosticos: [
      'Peritonitis asociada a diálisis peritoneal',
      'DM2 descompensada',
      'IRC estadio 3',
      'HAS',
    ],
    tratamiento: ['Cefepime 1 g IV c/8h', 'Paracetamol 1 g IV c/8h'],
    ta: '118/72',
    fr: '18',
    fc: '88',
    temp: '36.8',
    peso: '70',
    medico: 'Dr. Demo',
    profesor: '',
  };

  indicaciones[PITCH_DEMO_PATIENT_ID] = {
    fecha,
    hora,
    medicos: 'Dr. Demo · SERVICIO DEMO',
    dieta: 'Dieta renal, restricción de K y P',
    cuidados: 'Signos vitales c/8h, glucometría c/6h, balance hídrico estricto',
    estudios: 'Control de BH y QS mañana',
    medicamentos:
      '1. Cefepime 1 g IV c/8h\n2. Paracetamol 1 g IV c/8h PRN dolor\n3. Losartán 50 mg VO c/24h',
    interconsultas: 'Nefrología de seguimiento',
    otros: [],
  };

  try {
    labHistory[PITCH_DEMO_PATIENT_ID] = buildPitchLabHistoryEntries();
    bumpLabHistoryRevision(PITCH_DEMO_PATIENT_ID);
  } catch {
    delete labHistory[PITCH_DEMO_PATIENT_ID];
  }

  listadoProblemas[PITCH_DEMO_PATIENT_ID] = buildTourDemoListadoProblemas(fecha, hora);
  fillPitchDemoMedMaps(maps, fecha);
}

/** @param {Record<string, unknown>} maps @param {string} fecha */
function fillPitchDemoMedMaps(maps, fecha) {
  const { medRecetaByPatient, medNotaSelectionByPatient, recetaHuByPatient } = maps;

  medRecetaByPatient[PITCH_DEMO_PATIENT_ID] = {
    fechaActualizacion: fecha,
    items: [
      {
        id: 'pitch-med-1',
        nombreRaw: 'PARACETAMOL 1 G SOL INY (*)',
        viaRaw: 'VIA INTRAVENOSA',
        dosisRaw: '1 G //',
        frecuenciaRaw: 'CADA 8 HORAS',
        suspendido: false,
        diaTratamiento: null,
      },
      {
        id: 'pitch-med-2',
        nombreRaw: 'CEFEPIME 1 G SOL INY (*)',
        viaRaw: 'VIA INTRAVENOSA',
        dosisRaw: '1 G // *DIA# 2*',
        frecuenciaRaw: 'CADA 8 HORAS',
        suspendido: false,
        diaTratamiento: 2,
      },
    ],
  };
  medNotaSelectionByPatient[PITCH_DEMO_PATIENT_ID] = {
    'pitch-med-1': true,
    'pitch-med-2': true,
  };

  recetaHuByPatient[PITCH_DEMO_PATIENT_ID] = normalizeRecetaHuDraft({
    fecha,
    meds: [
      { medicamento: 'Cefepime', presentacion: '1 g IV', dosis: '1 g IV c/8h' },
      { medicamento: 'Paracetamol', presentacion: '1 g IV', dosis: '1 g IV c/8h PRN' },
    ],
    labs: ['Biometría hemática', 'Química sanguínea', 'Cultivos de control'],
    cuidados: 'Signos vitales, glucometría y balance hídrico',
    proximaCita: 'Consulta de Nefrología en 2 semanas',
    proximaCitaFecha: fecha,
  });
}
