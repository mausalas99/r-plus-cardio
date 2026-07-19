import { formatCensoMedsFromReceta } from './censo-meds-format.mjs';
import { formatLabsForCensoCompact } from './censo-labs-format.mjs';
import { diagnosticosTextForCenso } from './patient-diagnosticos.mjs';
import { formatCultivosForCenso } from './censo-cultivo-format.mjs';
import { formatAccesosForCenso } from './patient-accesos.mjs';
import { formatPendientesForCenso } from './censo-pendientes-format.mjs';
import { formatCensoSignosIoFromPatient } from './censo-signos-format.mjs';

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);
}

function pushSection(sections, label, lines) {
  if (lines && lines.length) sections.push({ label: label, lines: lines });
}

function medsLines(patient, ctx, pid) {
  var meds =
    String(patient.censoMedsText || '').trim() ||
    formatCensoMedsFromReceta(/** @type {{ items?: unknown[] }} */ (ctx.medRecetaByPatient[pid]));
  return splitLines(meds).slice(0, 6);
}

/** @param {Record<string, unknown>} patient @param {object} ctx */
export function buildPatientSections(patient, ctx) {
  var pid = String(patient.id);
  var sections = [];

  var dx = diagnosticosTextForCenso(patient.diagnosticosList);
  if (dx && dx !== '—') pushSection(sections, 'Diagnósticos', [dx]);

  pushSection(sections, 'ATB / Medicamentos', medsLines(patient, ctx, pid));

  var signosIo = formatCensoSignosIoFromPatient(patient);
  var signosLines = [];
  if (signosIo.signosCol) signosLines.push(signosIo.signosCol);
  if (signosIo.ioCol) signosLines.push(signosIo.ioCol);
  pushSection(sections, 'Signos / I-O', signosLines);

  pushSection(sections, 'Laboratorios', formatLabsForCensoCompact(ctx.labHistoryByPatient[pid] || []));

  var acc = formatAccesosForCenso(patient);
  if (acc && acc !== '—') pushSection(sections, 'Accesos', [acc]);

  var cult = formatCultivosForCenso(ctx.labHistoryByPatient[pid] || []);
  if (cult && cult !== '—') {
    pushSection(sections, 'Cultivos', cult.split(/\n\n+/).filter(Boolean));
  }

  pushSection(sections, 'Pendientes', formatPendientesForCenso(ctx.todosByPatient[pid] || []));

  return { sections: sections, signosIo: signosIo };
}
