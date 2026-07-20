/** Tour demo patient seeding — clinical bundle for guided tours. */
import { LAB_BULK_PATIENT_SEPARATOR } from '../../lab-bulk-paste.mjs';
import { buildTourMonitoreoHistorial } from '../../tour-demo-monitoreo.mjs';
import {
  applyTourDemoIngresoDates,
  buildTourDemoDates,
  buildTourDemoLabPasteBoth,
} from '../../tour-demo-dates.mjs';
import { seedTourDemoTodos, clearTourDemoTodos } from '../../tour-demo-todos.mjs';
import { buildTourDemoEventualidades } from '../../tour-demo-eventualidades.mjs';
import {
  DEMO_PATIENT_ID,
  DEMO_PATIENT_ID_2,
  DEMO_REGISTRO,
  DEMO_REGISTRO_2,
  findTourDemoPatientByRegistro,
} from '../../tour-demo-patient.mjs';
import { selectPatient } from '../patients.mjs';
import {
  patients,
  notes,
  indicaciones,
  labHistory,
  listadoProblemas,
  medRecetaByPatient,
  medNotaSelectionByPatient,
  saveState,
  setPatients,
} from '../../app-state.mjs';
import { getSettingsHelpRuntime } from './runtime.mjs';
import { tourState } from './tour-state.mjs';

const rt = getSettingsHelpRuntime();


function purgeTourDemoPatientsFromState() {
  var removedIds = [];
  setPatients(
    patients.filter(function (p) {
      if (!p) return false;
      var reg = String(p.registro || '').trim();
      var isTourDemo =
        p.id === DEMO_PATIENT_ID ||
        p.id === DEMO_PATIENT_ID_2 ||
        !!p.isDemo ||
        reg === DEMO_REGISTRO ||
        reg === DEMO_REGISTRO_2;
      if (isTourDemo) {
        if (p.id) removedIds.push(p.id);
        return false;
      }
      return true;
    })
  );
  removedIds.push(DEMO_PATIENT_ID, DEMO_PATIENT_ID_2);
  removedIds.forEach(function (id) {
    if (!id) return;
    delete notes[id];
    delete indicaciones[id];
    delete labHistory[id];
    delete medRecetaByPatient[id];
    delete listadoProblemas[id];
    if (medNotaSelectionByPatient[id]) delete medNotaSelectionByPatient[id];
  });
  clearTourDemoTodos();
}

var TOUR_STEPS_USE_DEMO_PEREZ = {
  servicio_default: true,
  sala_expediente_tabs: true,
  historia_clinica: true,
  estado_actual: true,
  cardio_descongestion: true,
  estado_actual_registro: true,
  estado_actual_review: true,
  eventualidades: true,
  listado_problemas: true,
  sala_med: true,
  sala_manejo: true,
  sala_ic_hoja: true,
  sala_tend: true,
  sala_tend_chart: true,
  sala_vpo: true,
  sala_receta_hu: true,
};

function findTourDemoPerezPatient() {
  return (
    patients.find(function (x) {
      return x && x.id === DEMO_PATIENT_ID;
    }) ||
    findTourDemoPatientByRegistro(patients, DEMO_REGISTRO)
  );
}

/** Monitoreo, eventualidades, pendientes y notas demo para DEMO PÉREZ (idempotente). */
function seedTourDemoPerezClinicalData() {
  var p = findTourDemoPerezPatient();
  if (!p) return false;
  var pid = p.id;
  var today = new Date();
  var tourDates = getTourDemoDateBundle(today);
  var fecha = tourDates.fecha;
  var hora = tourDates.hora;
  applyTourDemoIngresoDates(p, tourDates);
  var hist = p.monitoreo && Array.isArray(p.monitoreo.historial) ? p.monitoreo.historial : [];
  if (!hist.length) {
    p.monitoreo = buildTourMonitoreoHistorial(today);
  }
  var ev =
    p.eventualidades && Array.isArray(p.eventualidades.entries) ? p.eventualidades.entries : [];
  if (!ev.length) {
    p.eventualidades = buildTourDemoEventualidades(today);
  }
  if (!notes[pid] || !String((notes[pid].diagnosticos || [])[0] || '').trim()) {
    notes[pid] = {
      fecha: fecha,
      hora: hora,
      interrogatorio: '',
      evolucion: '',
      estudios: '',
      diagnosticos: ['DM2, IRC estadio 3, HAS'],
      tratamiento: [''],
      ta: '',
      fr: '',
      fc: '',
      temp: '',
      peso: '',
      medico: '',
      profesor: '',
    };
  }
  if (!indicaciones[pid]) {
    indicaciones[pid] = {
      fecha: fecha,
      hora: hora,
      medicos: '',
      dieta: '',
      cuidados: '',
      estudios: '',
      medicamentos: '',
      interconsultas: '',
      otros: [],
    };
  }
  if (!medRecetaByPatient[pid]) {
    medRecetaByPatient[pid] = {
      fechaActualizacion: fecha,
      items: [
        {
          id: 'tour-med-1',
          nombreRaw: 'PARACETAMOL 1 G SOL INY (*)',
          viaRaw: 'VIA INTRAVENOSA',
          dosisRaw: '1 G //',
          frecuenciaRaw: 'CADA 8 HORAS',
          suspendido: false,
          diaTratamiento: null,
        },
        {
          id: 'tour-med-2',
          nombreRaw: 'CEFTRIAXONA 1 G SOL INY (*)',
          viaRaw: 'VIA INTRAVENOSA',
          dosisRaw: '1 G // *DIA# 2*',
          frecuenciaRaw: 'CADA 24 HORAS',
          suspendido: false,
          diaTratamiento: 2,
        },
      ],
    };
    medNotaSelectionByPatient[pid] = { 'tour-med-1': true, 'tour-med-2': true };
  }
  seedTourDemoTodos(DEMO_PATIENT_ID);
  saveState();
  if (typeof rt.refreshAllTodoUIs === 'function') rt.refreshAllTodoUIs();
  return true;
}

function ensureTourPrimaryDemoPatientActive() {
  if (!tourState.guidedTourActive || tourState.guidedTourBranch === 'interconsulta') return false;
  var p = findTourDemoPerezPatient();
  if (!p) return false;
  var changed = rt.getActiveId() !== p.id;
  if (changed) {
    selectPatient(p.id);
  }
  seedTourDemoPerezClinicalData();
  if (changed && typeof rt.refreshExpedienteAfterPatientSelect === 'function') {
    rt.refreshExpedienteAfterPatientSelect();
  }
  return true;
}

function applyTourDemoPatientBundle(patientId, registro) {
  var reg = String(registro || '').trim();
  var today = new Date();
  var tourDates = getTourDemoDateBundle(today);
  var fecha = tourDates.fecha;
  var hora = tourDates.hora;
  var p = patients.find(function (x) {
    return x && x.id === patientId;
  });
  if (p) {
    applyTourDemoIngresoDates(p, tourDates);
    if (patientId === DEMO_PATIENT_ID) {
      p.monitoreo = buildTourMonitoreoHistorial(today);
    }
  }
  if (patientId === DEMO_PATIENT_ID) {
    seedTourDemoPerezClinicalData();
  } else if (patientId === DEMO_PATIENT_ID_2 || reg === DEMO_REGISTRO_2) {
    notes[patientId] = {
      fecha: fecha,
      hora: hora,
      interrogatorio: '',
      evolucion: '',
      estudios: '',
      diagnosticos: ['DM2 descompensada'],
      tratamiento: [''],
      ta: '',
      fr: '',
      fc: '',
      temp: '',
      peso: '',
      medico: '',
      profesor: '',
    };
    indicaciones[patientId] = {
      fecha: fecha,
      hora: hora,
      medicos: '',
      dieta: '',
      cuidados: '',
      estudios: '',
      medicamentos: '',
      interconsultas: '',
      otros: [],
    };
  }
  saveState();
}

function getTourDemoDateBundle(ref) {
  return buildTourDemoDates(ref || new Date());
}

function getDemoTourLabPaste(ref) {
  return buildTourDemoLabPasteBoth(ref);
}

function tourDemoLabPasteHasBoth(text) {
  var v = String(text || '');
  return (
    v.indexOf(DEMO_REGISTRO) !== -1 &&
    v.indexOf(DEMO_REGISTRO_2) !== -1 &&
    v.indexOf(LAB_BULK_PATIENT_SEPARATOR) !== -1
  );
}

/** Rellena el cuadro de lab con Pérez (2 días) + separador + García durante el tour. */
function ensureTourDemoLabInputBoth() {
  if (!tourState.guidedTourActive) return false;
  var li = document.getElementById('lab-input');
  if (!li) return false;
  if (!tourDemoLabPasteHasBoth(li.value)) {
    li.value = getDemoTourLabPaste();
  }
  return true;
}

export {
  TOUR_STEPS_USE_DEMO_PEREZ,
  purgeTourDemoPatientsFromState,
  applyTourDemoPatientBundle,
  ensureTourPrimaryDemoPatientActive,
  findTourDemoPerezPatient,
  getTourDemoDateBundle,
  getDemoTourLabPaste,
  tourDemoLabPasteHasBoth,
  ensureTourDemoLabInputBoth,
};
