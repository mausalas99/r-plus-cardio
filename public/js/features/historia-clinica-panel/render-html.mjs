import {
  compileHistoriaClinicaNarrative,
  compileHistoriaClinicaPlainText,
} from '../../../../lib/historia-clinica/compile-narrative.mjs';
import { HC_INTERROGADO_NEGADO } from '../../../../lib/historia-clinica/defaults.mjs';
import { toClinicalHistoryText } from '../../../../lib/historia-clinica/clinical-text.mjs';
import { esc } from './runtime.mjs';
import { CATALOGS, ipasSystems } from './catalogs.mjs';
import { compileCtx, signosVitalesFromMonitoreo, trimHc } from './data-normalize.mjs';
import { getDirtyKeys, hcState } from './state.mjs';

export function stepComplete(n) {
  if (!hcState.data) return false;
  if (n === 1) return !!String(hcState.data.motivoConsulta || '').trim();
  if (n === 2) {
    return (
      !!String(hcState.data.padecimientoActual || '').trim() ||
      Object.keys(ipasSystems).every(function (sid) {
        var b = hcState.data.ipas && hcState.data.ipas[sid];
        return b && b.negado;
      })
    );
  }
  if (n === 3) return !!(hcState.data.meta && hcState.data.meta.admissionConfirmedLabs);
  return false;
}

export function renderStepperHeader() {
  var labels = ['Antecedentes', 'Padecimiento e IPAS', 'Ingreso y labs'];
  return (
    '<nav class="hc-stepper" aria-label="Pasos historia clínica">' +
    labels
      .map(function (label, i) {
        var n = i + 1;
        var cls =
          'hc-step' +
          (n === hcState.step ? ' hc-step--active' : '') +
          (stepComplete(n) ? ' hc-step--done' : '');
        return (
          '<button type="button" class="' +
          cls +
          '" data-hc-step="' +
          n +
          '">' +
          esc(label) +
          '</button>'
        );
      })
      .join('') +
    '</nav>'
  );
}

function fieldRow(label, html) {
  return (
    '<div class="field-group">' +
    '<label>' +
    esc(label) +
    '</label>' +
    html +
    '</div>'
  );
}

function textInput(path, value, placeholder) {
  return (
    '<input type="text" data-hc-path="' +
    esc(path) +
    '" value="' +
    esc(toClinicalHistoryText(value)) +
    '" placeholder="' +
    esc(placeholder ? toClinicalHistoryText(placeholder) : '') +
    '">'
  );
}

function textArea(path, value, rows, placeholder) {
  return (
    '<textarea data-hc-path="' +
    esc(path) +
    '" rows="' +
    (rows || 4) +
    '" placeholder="' +
    esc(placeholder ? toClinicalHistoryText(placeholder) : '') +
    '">' +
    esc(toClinicalHistoryText(value)) +
    '</textarea>'
  );
}

export function renderLecturaView(root, patient) {
  var sections = compileHistoriaClinicaNarrative(hcState.data, CATALOGS, compileCtx(patient));
  root.innerHTML =
    '<div class="hc-read-view">' +
    sections
      .map(function (s) {
        return (
          '<section class="card hc-read-section"><h3 class="card-header">' +
          esc(s.title) +
          '</h3><div class="card-body hc-read-body">' +
          esc(s.body).replace(/\n/g, '<br>') +
          '</div></section>'
        );
      })
      .join('') +
    (sections.length ? '' : '<p class="tend-empty">Historia sin contenido.</p>') +
    '</div>';
}

export function renderStep1() {
  var id = (hcState.data && hcState.data.identificacion) || {};
  var apnp = (hcState.data && hcState.data.apnp) || {};
  return (
    '<div class="hc-step-body">' +
    '<h3 class="hc-step-title">Identificación y antecedentes</h3>' +
    fieldRow('Motivo de consulta', textArea('motivoConsulta', hcState.data.motivoConsulta, 2)) +
    '<details class="card" open><summary class="card-header">Identificación</summary><div class="card-body hc-grid">' +
    fieldRow('Informante', textInput('identificacion.informante', id.informante)) +
    fieldRow('Lugar de nacimiento', textInput('identificacion.lugarNacimiento', id.lugarNacimiento)) +
    fieldRow('Ocupación actual', textInput('identificacion.ocupacionActual', id.ocupacionActual)) +
    fieldRow('Ocupación anterior', textInput('identificacion.ocupacionAnterior', id.ocupacionAnterior)) +
    fieldRow('Escolaridad', textInput('identificacion.escolaridad', id.escolaridad)) +
    fieldRow('Estado civil', textInput('identificacion.estadoCivil', id.estadoCivil)) +
    fieldRow('Religión', textInput('identificacion.religion', id.religion)) +
    '</div></details>' +
    '<details class="card" open><summary class="card-header">APNP</summary><div class="card-body">' +
    '<div class="hc-apnp-habits">' +
    '<div class="card hc-calc-wrap"><div class="card-header card-header--tone-slate">Tabaquismo</div><div class="card-body" id="hc-mount-tabaquismo"></div></div>' +
    '<div class="card hc-calc-wrap"><div class="card-header card-header--tone-slate">Alcoholismo</div><div class="card-body" id="hc-mount-alcoholismo"></div></div>' +
    '</div>' +
    '<div class="card hc-apnp-toxicomanias" style="margin-top:12px"><div class="card-header card-header--tone-slate">Toxicomanías</div><div class="card-body" id="hc-mount-toxicomanias"></div></div>' +
    '<div class="hc-grid" style="margin-top:12px">' +
    fieldRow('Tatuajes', textInput('apnp.tatuajes', apnp.tatuajes)) +
    fieldRow('Deportes/pasatiempos/mascotas', textInput('apnp.deportesPasatiemposMascotas', apnp.deportesPasatiemposMascotas)) +
    fieldRow('Dieta', textInput('apnp.dieta', apnp.dieta)) +
    '</div></details>' +
    '<details class="card" open><summary class="card-header">APP</summary><div class="card-body" id="hc-mount-app"></div></details>' +
    '<details class="card" open><summary class="card-header">AHF</summary><div class="card-body" id="hc-mount-ahf"></div></details>' +
    '</div>'
  );
}

export function renderStep2() {
  var sexual = (hcState.data && hcState.data.sexual) || {};
  return (
    '<div class="hc-step-body">' +
    '<h3 class="hc-step-title">Padecimiento e IPAS</h3>' +
    '<details class="card" open><summary class="card-header">Antecedentes por género</summary><div class="card-body" id="hc-mount-genero"></div></details>' +
    '<details class="card" open><summary class="card-header">Antecedentes sexuales</summary><div class="card-body hc-grid">' +
    fieldRow('IVS (edad)', textInput('sexual.ivsEdad', sexual.ivsEdad)) +
    fieldRow('Preferencias', textInput('sexual.preferencias', sexual.preferencias)) +
    fieldRow('Parejas', textInput('sexual.parejas', sexual.parejas)) +
    fieldRow('Portador VIH', textInput('sexual.portadorVih', sexual.portadorVih)) +
    fieldRow('Fecha dx VIH', textInput('sexual.fechaDxVih', sexual.fechaDxVih)) +
    fieldRow('ETS', textInput('sexual.ets', sexual.ets)) +
    '</div></details>' +
    fieldRow('Padecimiento actual (ingreso)', textArea('padecimientoActual', hcState.data.padecimientoActual, 8)) +
    fieldRow(
      'Datos relevantes negados',
      textArea(
        'datosNegados',
        hcState.data.datosNegados || HC_INTERROGADO_NEGADO,
        3,
        HC_INTERROGADO_NEGADO
      )
    ) +
    '<div id="hc-mount-ipas"></div>' +
    '</div>'
  );
}

function renderVitalsIngresoBlock(patient) {
  var derived = signosVitalesFromMonitoreo(patient);
  var has = !!derived;
  var legacy = trimHc(hcState.data && hcState.data.signosVitalesIngreso);
  var display = has ? derived : legacy;
  return fieldRow(
    'Signos vitales al ingreso',
    '<div class="hc-vitals-ingreso' +
      (has ? '' : ' hc-vitals-ingreso--empty') +
      '">' +
      (has
        ? '<p class="hc-vitals-ingreso__text">' +
          esc(display) +
          '</p>' +
          '<p class="profile-hint hc-vitals-ingreso__source">Tomados del registro en <strong>Estado actual</strong>.</p>'
        : '<p class="profile-hint hc-vitals-ingreso__empty-msg">Registra los signos vitales en la pestaña <strong>Estado actual</strong> (monitoreo). Aparecerán aquí al volver a este paso.</p>') +
      '<button type="button" class="' +
      (has ? 'btn-med-secondary' : 'btn-generate') +
      ' hc-vitals-ingreso__cta" id="hc-go-estado-actual">' +
      (has ? 'Ir a Estado actual' : 'Registrar en Estado actual') +
      '</button></div>'
  );
}

export function renderLabsStep(patient) {
  var anchor = hcState.data && hcState.data.labAnchor;
  var labs = hcState.data && hcState.data.labsAtAdmission;
  var summary =
    anchor && anchor.egfr != null
      ? 'eTFG ' +
        anchor.egfr +
        ' · Cr ' +
        (anchor.creatinineMgDl != null ? anchor.creatinineMgDl : '—') +
        ' · ' +
        esc(anchor.fecha)
      : 'Sin laboratorios de ingreso anclados';
  return (
    '<div class="hc-step-body">' +
    '<h3 class="hc-step-title">Ingreso y laboratorios</h3>' +
    renderVitalsIngresoBlock(patient) +
    '<div class="card"><div class="card-body"><p class="profile-hint">' +
    esc(summary) +
    '</p>' +
    (labs && labs.qsSummary ? '<pre class="hc-labs-pre">' + esc(labs.qsSummary) + '</pre>' : '') +
    '<button type="button" class="btn-med-secondary" id="hc-resync-labs">Re-sincronizar labs</button> ' +
    '<button type="button" class="btn-med-secondary" id="hc-pick-labs">Elegir set de labs</button>' +
    '</div></div></div>'
  );
}

export function compileHistoriaPlainText(patient) {
  return compileHistoriaClinicaPlainText(
    compileHistoriaClinicaNarrative(hcState.data, CATALOGS, compileCtx(patient))
  );
}

export function compileHistoriaTeaser(patient, maxSections) {
  return compileHistoriaClinicaPlainText(
    compileHistoriaClinicaNarrative(hcState.data, CATALOGS, compileCtx(patient)).slice(0, maxSections)
  );
}

export function setByPath(path, value) {
  if (!hcState.data || !path) return;
  if (typeof value === 'string') value = toClinicalHistoryText(value);
  var parts = path.split('.');
  var key = parts[0];
  getDirtyKeys().add(key);
  if (parts.length === 1) {
    hcState.data[key] = value;
    return;
  }
  if (!hcState.data[key] || typeof hcState.data[key] !== 'object') hcState.data[key] = {};
  hcState.data[key][parts[1]] = value;
}
