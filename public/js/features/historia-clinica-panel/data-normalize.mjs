import {
  defaultHistoriaClinicaData,
  HC_INTERROGADO_NEGADO,
} from '../../../../lib/historia-clinica/defaults.mjs';
import { migrateLegacyHistoriaData } from '../../../../lib/historia-clinica/migrate-legacy.mjs';
import { normalizeAppData } from '../../../../lib/historia-clinica/normalize-app.mjs';
import { syncAhfConditionsFromEntries } from '../../../../lib/historia-clinica/compile-ahf.mjs';
import { normalizeGeneroBlock } from '../../../../lib/historia-clinica/genero-options.mjs';
import {
  applyClinicalHistoryUppercase,
} from '../../../../lib/historia-clinica/clinical-text.mjs';
import {
  formatSignosVitalesIngresoFromSnapshot,
  signosVitalesSnapshotHasData,
} from '../../../../lib/historia-clinica/signos-vitales-ingreso.mjs';
import { summarizeToxicomanias } from '../../../../lib/historia-clinica/toxicomanias.mjs';
import { deriveSnapshot, ensureMonitoreo } from '../estado-actual-data.mjs';
import { lookbackHours } from './runtime.mjs';
import { CATALOGS, DEFAULT_LOOKBACK_H, ipasSystems } from './catalogs.mjs';
import { getDirtyKeys, hcState } from './state.mjs';

export function trimHc(s) {
  return String(s || '').trim();
}

function fillIdentificacionFromPatient(id, patient) {
  if (!id.informante && patient.nombre) id.informante = String(patient.nombre);
  if (!id.registro && patient.registro) id.registro = String(patient.registro);
  if (!id.cama && patient.cama) id.cama = String(patient.cama);
  if (!id.dx && patient.diagnosticosText) id.dx = String(patient.diagnosticosText);
  if (!id.dx && Array.isArray(patient.diagnosticosList) && patient.diagnosticosList[0]) {
    id.dx = String(patient.diagnosticosList[0]);
  }
  if (patient.edad != null && patient.edad !== '') {
    id.edad = String(patient.edad);
  }
  return id;
}

function prefillFromPatient(data, patient) {
  if (!data || !patient) return data;
  data.genero = normalizeGeneroBlock(data.genero, patient.sexo);
  data.identificacion = fillIdentificacionFromPatient(data.identificacion || {}, patient);
  return data;
}

function normalizeApp(app) {
  return normalizeAppData(app, defaultHistoriaClinicaData('_', CATALOGS).app);
}

function normalizeAhf(ahf) {
  var def = defaultHistoriaClinicaData('_', CATALOGS).ahf;
  ahf = Object.assign({}, def, ahf || {});
  if (!Array.isArray(ahf.customConditions)) ahf.customConditions = [];
  if (!Array.isArray(ahf.entries)) ahf.entries = [];
  if (!Array.isArray(ahf.conditions)) ahf.conditions = [];
  if (ahf.entries.length) {
    return syncAhfConditionsFromEntries(ahf);
  }
  if (ahf.conditions.length && !ahf.entries.length) {
    ahf.entries = ahf.conditions.map(function (cid) {
      return {
        id: 'ahf_legacy_' + cid,
        conditionId: cid,
        relativeId: '',
        diagnosis: trimHc(ahf.descripcionDetallada) || '',
        treatment: '',
        vitalStatus: 'desconocido',
      };
    });
    ahf.descripcionDetallada = '';
  }
  return syncAhfConditionsFromEntries(ahf);
}

function normalizeApnp(apnp) {
  apnp = apnp && typeof apnp === 'object' ? Object.assign({}, apnp) : {};
  if (!apnp.tabaquismoDetail || typeof apnp.tabaquismoDetail !== 'object') {
    apnp.tabaquismoDetail = {
      status: trimHc(apnp.tabaquismo) && !/^negado$/i.test(trimHc(apnp.tabaquismo)) ? 'activo' : 'negado',
    };
  }
  if (!apnp.alcoholismoDetail || typeof apnp.alcoholismoDetail !== 'object') {
    apnp.alcoholismoDetail = {
      status: trimHc(apnp.alcoholismo) && !/^negado$/i.test(trimHc(apnp.alcoholismo)) ? 'activo' : 'negado',
    };
  }
  const tox = summarizeToxicomanias(apnp);
  apnp.toxicomaniasEntries = tox.entries;
  if (!trimHc(apnp.toxicomanias) || /^negad/i.test(trimHc(apnp.toxicomanias))) {
    apnp.toxicomanias = tox.summary;
  }
  return apnp;
}

export function signosVitalesFromMonitoreo(patient) {
  if (!patient) return '';
  ensureMonitoreo(patient);
  var mon = patient.monitoreo;
  var snap = deriveSnapshot(mon);
  if (!signosVitalesSnapshotHasData(snap)) return '';
  var ec = mon && mon.estadoClinico && typeof mon.estadoClinico === 'object' ? mon.estadoClinico : null;
  return formatSignosVitalesIngresoFromSnapshot(snap, ec);
}

export function compileCtx(patient) {
  var age = patient && patient.edad != null ? Number(patient.edad) : NaN;
  return {
    currentAge: Number.isFinite(age) ? age : undefined,
    patientSex: patient && patient.sexo === 'M' ? 'M' : 'F',
    signosVitalesIngresoFromMonitoreo: signosVitalesFromMonitoreo(patient),
  };
}

export function syncSignosVitalesIngresoFromEstadoActual(patient) {
  if (!hcState.data || !patient) return;
  var derived = signosVitalesFromMonitoreo(patient);
  if (derived) {
    hcState.data.signosVitalesIngreso = derived;
    getDirtyKeys().add('signosVitalesIngreso');
  }
}

export function normalizeData(raw, patientId, patient) {
  if (!raw || typeof raw !== 'object') {
    return prefillFromPatient(
      defaultHistoriaClinicaData(patientId, CATALOGS, {
        labLookbackHours: lookbackHours(DEFAULT_LOOKBACK_H),
      }),
      patient
    );
  }
  var base = migrateLegacyHistoriaData(raw, CATALOGS);
  if (!base.app || typeof base.app !== 'object') {
    var fresh = defaultHistoriaClinicaData(patientId, CATALOGS, {
      labLookbackHours: lookbackHours(DEFAULT_LOOKBACK_H),
    });
    fresh.labAnchor = raw.labAnchor || null;
    fresh.labsAtAdmission = raw.labsAtAdmission || null;
    fresh.meta = Object.assign({}, fresh.meta, raw.meta || {});
    base = fresh;
  }
  base.labLookbackHours = base.labLookbackHours || lookbackHours(DEFAULT_LOOKBACK_H);
  if (!trimHc(base.datosNegados)) {
    base.datosNegados = HC_INTERROGADO_NEGADO;
  }
  base.genero = normalizeGeneroBlock(base.genero, patient && patient.sexo);
  if (!base.ipas || typeof base.ipas !== 'object') {
    base.ipas = {};
  }
  Object.keys(ipasSystems).forEach(function (sid) {
    var block = base.ipas[sid];
    if (!block || typeof block !== 'object') {
      base.ipas[sid] = { checks: [], descripcion: HC_INTERROGADO_NEGADO, negado: true };
      return;
    }
    if (block.negado !== false && !trimHc(block.descripcion) && !(block.checks && block.checks.length)) {
      block.descripcion = HC_INTERROGADO_NEGADO;
      block.negado = true;
    }
  });
  base.apnp = normalizeApnp(base.apnp);
  base.app = normalizeApp(base.app);
  base.ahf = normalizeAhf(base.ahf);
  base = prefillFromPatient(base, patient);
  applyClinicalHistoryUppercase(base);
  return base;
}
