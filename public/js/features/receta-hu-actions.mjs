import { rt, aid, persistDraft, consultServices, saveConsultServices, readDraftFromDom } from './receta-hu-shared.mjs';
import { buildProximaCitaText } from '../receta-hu-core.mjs';
import {
  renderMedList,
  renderLabList,
  renderProximaCitaList,
  renderConsultServiceSelect,
} from './receta-hu-list-render.mjs';

function recetaHuRoot() {
  return document.getElementById('receta-hu-container');
}

function readMedComposeFields() {
  var nEl = document.getElementById('receta-hu-compose-med-n');
  var pEl = document.getElementById('receta-hu-compose-med-p');
  var dEl = document.getElementById('receta-hu-compose-med-d');
  return {
    nEl: nEl,
    pEl: pEl,
    dEl: dEl,
    medicamento: nEl ? String(nEl.value || '').trim() : '',
    presentacion: pEl ? String(pEl.value || '').trim() : '',
    dosis: dEl ? String(dEl.value || '').trim() : '',
  };
}

function medComposeIsEmpty(fields) {
  return !fields.medicamento && !fields.presentacion && !fields.dosis;
}

function clearMedComposeFields(fields) {
  if (fields.nEl) fields.nEl.value = '';
  if (fields.pEl) fields.pEl.value = '';
  if (fields.dEl) fields.dEl.value = '';
}

export function recetaHuCommitMedFromCompose() {
  var pid = aid();
  if (!pid) return;
  var fields = readMedComposeFields();
  if (medComposeIsEmpty(fields)) {
    rt.showToast('Escribe al menos un campo del medicamento', 'error');
    if (fields.nEl) fields.nEl.focus();
    return;
  }
  var draft = readDraftFromDom();
  draft.meds.push({
    medicamento: fields.medicamento,
    presentacion: fields.presentacion,
    dosis: fields.dosis,
  });
  persistDraft(pid, draft);
  clearMedComposeFields(fields);
  renderMedList(recetaHuRoot(), draft.meds);
  if (fields.nEl) fields.nEl.focus();
}

export function recetaHuRemoveMedRow(idx) {
  var pid = aid();
  if (!pid) return;
  var draft = readDraftFromDom();
  draft.meds.splice(idx, 1);
  persistDraft(pid, draft);
  renderMedList(recetaHuRoot(), draft.meds);
}

export function recetaHuCommitLabFromCompose() {
  var pid = aid();
  if (!pid) return;
  var inp = document.getElementById('receta-hu-compose-lab');
  var name = inp ? String(inp.value || '').trim() : '';
  if (!name) {
    rt.showToast('Escribe el nombre del estudio', 'error');
    if (inp) inp.focus();
    return;
  }
  var draft = readDraftFromDom();
  draft.labs.push(name);
  persistDraft(pid, draft);
  if (inp) inp.value = '';
  renderLabList(recetaHuRoot(), draft.labs);
  if (inp) inp.focus();
}

export function recetaHuRemoveLabRow(idx) {
  var pid = aid();
  if (!pid) return;
  var draft = readDraftFromDom();
  var items = draft.labs.filter(function (x) {
    return String(x || '').trim();
  });
  items.splice(idx, 1);
  draft.labs = items;
  persistDraft(pid, draft);
  renderLabList(recetaHuRoot(), draft.labs);
}

export function recetaHuOnConsultServicePick() {
  var sel = document.getElementById('receta-hu-consult-servicio');
  var plazoEl = document.getElementById('receta-hu-compose-proxima-plazo');
  var textoEl = document.getElementById('receta-hu-compose-proxima-texto');
  if (!sel || !textoEl) return;
  var text = buildProximaCitaText(plazoEl ? plazoEl.value : '', sel.value);
  if (text) textoEl.value = text;
}

function readProximaComposeFields() {
  var plazoEl = document.getElementById('receta-hu-compose-proxima-plazo');
  var sel = document.getElementById('receta-hu-consult-servicio');
  var textoEl = document.getElementById('receta-hu-compose-proxima-texto');
  var fechaEl = document.getElementById('receta-hu-compose-proxima-fecha');
  return {
    plazoEl: plazoEl,
    sel: sel,
    textoEl: textoEl,
    fechaEl: fechaEl,
    plazo: plazoEl ? String(plazoEl.value || '').trim() : '',
    servicio: sel ? String(sel.value || '').trim() : '',
    texto: textoEl ? String(textoEl.value || '').trim() : '',
    fecha: fechaEl ? String(fechaEl.value || '').trim() : '',
  };
}

function resolveProximaTexto(fields, draft) {
  var texto = fields.texto;
  if (!texto && fields.servicio) {
    texto = buildProximaCitaText(fields.plazo || '2 semanas', fields.servicio);
  }
  if (!texto && !fields.fecha) {
    rt.showToast('Elige servicio o escribe el texto de la consulta', 'error');
    if (fields.sel) fields.sel.focus();
    return null;
  }
  var plazo = fields.plazo || draft.proximaPlazo || '2 semanas';
  return { texto: texto, plazo: plazo };
}

function clearProximaComposeFields(fields) {
  if (fields.textoEl) fields.textoEl.value = '';
  if (fields.fechaEl) fields.fechaEl.value = '';
  if (fields.sel) fields.sel.value = '';
}

export function recetaHuCommitProximaFromCompose() {
  var pid = aid();
  if (!pid) return;
  var fields = readProximaComposeFields();
  var draft = readDraftFromDom();
  var resolved = resolveProximaTexto(fields, draft);
  if (!resolved) return;
  draft.proximaPlazo = resolved.plazo;
  draft.proximasCitas.push({
    plazo: resolved.plazo,
    servicio: fields.servicio,
    texto: resolved.texto,
    fecha: fields.fecha,
  });
  persistDraft(pid, draft);
  clearProximaComposeFields(fields);
  renderProximaCitaList(recetaHuRoot(), draft.proximasCitas);
  if (fields.plazoEl) fields.plazoEl.focus();
}

export function recetaHuRemoveProximaRow(idx) {
  var pid = aid();
  if (!pid) return;
  var draft = readDraftFromDom();
  draft.proximasCitas.splice(idx, 1);
  persistDraft(pid, draft);
  renderProximaCitaList(recetaHuRoot(), draft.proximasCitas);
}

export function recetaHuAddConsultService() {
  var sel = document.getElementById('receta-hu-consult-servicio');
  if (!sel) return;
  var name = window.prompt('Nombre del servicio para el menú (ej. Nefrología):', sel.value || '');
  if (!name) return;
  var trimmed = String(name).trim();
  if (!trimmed) return;
  var list = consultServices();
  if (list.indexOf(trimmed) < 0) {
    list.push(trimmed);
    saveConsultServices(list);
  }
  var root = recetaHuRoot();
  var draft = readDraftFromDom();
  renderConsultServiceSelect(root, draft);
  var sel2 = document.getElementById('receta-hu-consult-servicio');
  if (sel2) {
    sel2.value = trimmed;
    recetaHuOnConsultServicePick();
  }
  rt.showToast('Servicio agregado al menú', 'success');
}
