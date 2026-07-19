/** IDs y registros del paciente demo del tour guiado (no confundir con demo-pitch). */

export const DEMO_PATIENT_ID = 'demo-onboarding';
export const DEMO_PATIENT_ID_2 = 'demo-onboarding-2';
export const DEMO_REGISTRO = '0008421-7';
export const DEMO_REGISTRO_2 = '0007755-3';

const REGISTRO_TO_DEMO_ID = {
  [DEMO_REGISTRO]: DEMO_PATIENT_ID,
  [DEMO_REGISTRO_2]: DEMO_PATIENT_ID_2,
};

/** @type {{
 *   isTourActive?(): boolean,
 *   getTourStep?(): string|null,
 *   applyBundle?(patientId: string, registro: string): void,
 *   switchAppTab?(tab: string): void,
 *   showToast?(msg: string, type?: string): void,
 * }} */
let hooks = {};

export function registerTourDemoPatientHooks(ctx) {
  if (!ctx || typeof ctx !== 'object') return;
  Object.assign(hooks, ctx);
}

export function isTourDemoRegistro(registro) {
  var r = String(registro || '').trim();
  return r === DEMO_REGISTRO || r === DEMO_REGISTRO_2;
}

export function getDemoPatientIdForRegistro(registro) {
  return REGISTRO_TO_DEMO_ID[String(registro || '').trim()] || null;
}

/** Cuarto/cama sugeridos al dar de alta pacientes demo durante el tour. */
export function getTourDemoAdmitDefaults(registro) {
  if (!hooks.isTourActive || !hooks.isTourActive()) return null;
  var r = String(registro || '').trim();
  if (r === DEMO_REGISTRO) return { servicio: 'MEDICINA INTERNA', cuarto: '214', cama: '2' };
  if (r === DEMO_REGISTRO_2) return { servicio: 'MEDICINA INTERNA', cuarto: '214', cama: '4' };
  return null;
}

/**
 * @param {Array<{ id?: string, registro?: string, isDemo?: boolean }>} patientsList
 * @returns {string|null}
 */
export function resolveTourDemoPatientId(patientsList) {
  if (!patientsList || !patientsList.length) return null;
  var byId = patientsList.find(function (p) {
    return p && p.id === DEMO_PATIENT_ID;
  });
  if (byId) return DEMO_PATIENT_ID;
  var byReg = patientsList.find(function (p) {
    return p && String(p.registro || '').trim() === DEMO_REGISTRO;
  });
  return byReg ? byReg.id : null;
}

/**
 * @param {string|null|undefined} id
 * @param {Array<{ id?: string, isDemo?: boolean }>} [patientsList]
 */
export function isTourDemoPatientId(id, patientsList) {
  if (!id) return false;
  if (id === DEMO_PATIENT_ID || id === DEMO_PATIENT_ID_2) return true;
  if (!patientsList) return false;
  var p = patientsList.find(function (x) {
    return x && x.id === id;
  });
  return !!(p && p.isDemo);
}

export function shouldTourStayOnLabAfterLabCommit() {
  return !!(hooks.isTourActive && hooks.isTourActive() && hooks.getTourStep && hooks.getTourStep() === 'lab_parse');
}

/**
 * @param {Array<{ registro?: string, id?: string }>} patientsList
 * @param {string} registro
 */
export function findTourDemoPatientByRegistro(patientsList, registro) {
  var r = String(registro || '').trim();
  if (!r || !patientsList) return null;
  return (
    patientsList.find(function (p) {
      return p && String(p.registro || '').trim() === r;
    }) || null
  );
}

/** @param {Array<{ registro?: string }>} patientsList */
export function tourDemoPatientsBothInCensus(patientsList) {
  return !!(
    findTourDemoPatientByRegistro(patientsList, DEMO_REGISTRO) &&
    findTourDemoPatientByRegistro(patientsList, DEMO_REGISTRO_2)
  );
}

function hasLabHistory(hist) {
  return !!(hist && (Array.isArray(hist) ? hist.length : Object.keys(hist).length));
}

/**
 * @param {Array<{ registro?: string, id?: string }>} patientsList
 * @param {Record<string, unknown>} labHistoryMap
 */
/**
 * Tras dar de alta a García en el tour, mantener a Pérez como paciente activo.
 * @param {string} committedPatientId
 * @param {Array<{ id?: string, registro?: string }>} patientsList
 */
export function shouldSelectTourPrimaryAfterLabCommit(committedPatientId, patientsList) {
  if (!hooks.isTourActive || !hooks.isTourActive()) return false;
  if (committedPatientId === DEMO_PATIENT_ID) return false;
  if (committedPatientId !== DEMO_PATIENT_ID_2) return false;
  return !!findTourDemoPatientByRegistro(patientsList, DEMO_REGISTRO);
}

export function tourDemoLabCompleteForTour(patientsList, labHistoryMap) {
  var p1 = findTourDemoPatientByRegistro(patientsList, DEMO_REGISTRO);
  var p2 = findTourDemoPatientByRegistro(patientsList, DEMO_REGISTRO_2);
  if (!p1 || !p2) return false;
  return hasLabHistory(labHistoryMap && labHistoryMap[p1.id]) && hasLabHistory(labHistoryMap && labHistoryMap[p2.id]);
}

/**
 * @param {object} patient
 * @param {string} registro
 * @returns {{ patient: object, afterCommit?: (saved: object) => void }}
 */
export function adoptTourPatientOnCommit(patient, registro) {
  if (!hooks.isTourActive || !hooks.isTourActive()) {
    return { patient: patient };
  }
  var demoId = getDemoPatientIdForRegistro(registro);
  if (!demoId) {
    return { patient: patient };
  }
  patient.id = demoId;
  patient.isDemo = true;
  var stayOnLab = shouldTourStayOnLabAfterLabCommit();
  return {
    patient: patient,
    afterCommit: function () {
      if (hooks.applyBundle) hooks.applyBundle(demoId, registro);
      if (stayOnLab) {
        if (hooks.switchAppTab) hooks.switchAppTab('lab');
        if (hooks.showToast) {
          hooks.showToast(
            'Paciente registrado. Registra al otro paciente demo si falta y pulsa Procesar otra vez.',
            'info'
          );
        }
      }
    },
  };
}
