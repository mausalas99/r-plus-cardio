import { storage } from '../storage.js';
import { mountRpcDatetimeInput } from '../rpc-date-picker.mjs';

export function paIsoToDatetimeLocalValue(isoStr) {
  const d = new Date(String(isoStr || '').trim());
  if (isNaN(d.getTime())) return '';
  const pad = function (x) {
    return String(x).padStart(2, '0');
  };
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
    pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
}

export function paParseDatetimeLocalValue(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** @param {string} editEventId @param {Array<object>} elig @param {() => string|null} getActiveId */
export function fillProcedureAgendaModalForEdit(editEventId, _elig) {
  const found = storage.getScheduledProcedures().filter(function (e) {
    return e.id === editEventId;
  })[0];
  const sel = document.getElementById('pa-patient');
  if (found && sel) {
    sel.value = String(found.patientId);
    if (sel.value !== String(found.patientId)) {
      sel.appendChild(new Option(found.patientId, found.patientId));
    }
    sel.value = String(found.patientId);
  }
  if (!found) return;
  document.getElementById('pa-procedure').value = found.procedure || '';
  document.getElementById('pa-location').value = found.location || '';
  document.getElementById('pa-start').value = paIsoToDatetimeLocalValue(found.start);
  document.getElementById('pa-material').checked = !!found.materialApproved;
  document.getElementById('pa-anesthesia').checked = !!found.anesthesiaScheduled;
}

/** @param {Array<object>} elig @param {() => string|null} getActiveId */
export function fillProcedureAgendaModalForNew(elig, getActiveId) {
  const sel = document.getElementById('pa-patient');
  const aid = getActiveId();
  if (sel && elig.length && aid && elig.some(function (p) { return p.id === aid; })) {
    sel.value = String(aid);
  } else if (sel && elig[0]) {
    sel.value = elig[0].id;
  }
  document.getElementById('pa-procedure').value = '';
  document.getElementById('pa-location').value = '';
  document.getElementById('pa-start').value = paIsoToDatetimeLocalValue(new Date().toISOString());
  document.getElementById('pa-material').checked = false;
  document.getElementById('pa-anesthesia').checked = false;
}

export function syncProcedureAgendaModalDatetime() {
  const paStart = document.getElementById('pa-start');
  if (!paStart) return;
  mountRpcDatetimeInput(paStart);
  paStart.dispatchEvent(new CustomEvent('rpc-datetime-sync'));
}

/**
 * @param {Array<object>} elig
 * @returns {{ ok: true, patientId: string, procedure: string, location: string, sd: Date, editId: string } | { ok: false, msg: string }}
 */
export function validateProcedureAgendaForm(elig) {
  const editId = (document.getElementById('pa-edit-id').value || '').trim();
  const patientId = String(document.getElementById('pa-patient').value || '').trim();
  const procedure = String(document.getElementById('pa-procedure').value || '').trim();
  const location = String(document.getElementById('pa-location').value || '').trim();
  const sd = paParseDatetimeLocalValue(document.getElementById('pa-start').value);
  if (!elig.length) {
    return { ok: false, msg: 'No hay pacientes reales para agendar (agrega un paciente desde la barra lateral).' };
  }
  if (!patientId || !elig.some(function (p) { return String(p.id) === patientId; })) {
    return { ok: false, msg: 'Elige un paciente válido de la lista.' };
  }
  if (!procedure) return { ok: false, msg: 'Indica el procedimiento.' };
  if (!location) return { ok: false, msg: 'Indica el lugar.' };
  if (!sd) return { ok: false, msg: 'Fecha u hora de inicio inválidas.' };
  return { ok: true, patientId, procedure, location, sd, editId };
}

/** @param {{ editId: string, patientId: string, procedure: string, location: string, sd: Date }} fields */
export function buildProcedureAgendaEvent(fields) {
  const nowIso = new Date().toISOString();
  const arr = storage.getScheduledProcedures();
  const prev = fields.editId ? arr.filter(function (e) { return e.id === fields.editId; })[0] : null;
  return {
    id: fields.editId || 'proc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9),
    patientId: fields.patientId,
    procedure: fields.procedure,
    location: fields.location,
    materialApproved: !!document.getElementById('pa-material').checked,
    anesthesiaScheduled: !!document.getElementById('pa-anesthesia').checked,
    start: fields.sd.toISOString(),
    createdAt: prev && prev.createdAt ? prev.createdAt : nowIso,
    updatedAt: nowIso,
  };
}
