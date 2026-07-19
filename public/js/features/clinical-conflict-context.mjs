import { formatFieldLabel } from '../lan-conflict-silent-match.mjs';

import { escHtml } from '../dom-escape.mjs';
const ENTITY_LABELS = {
  historiaClinica: 'Historia clínica',
  patient: 'Datos del paciente',
  todo: 'Pendiente',
  agenda: 'Evento de agenda',
  roomBundle: 'Sala (agenda y pendientes)',
};

/** @param {object} ctx */
export function buildConflictLeadLine(ctx) {
  const entityLabel = ENTITY_LABELS[ctx.entityType] || formatFieldLabel(ctx.entityType) || 'Registro clínico';
  if (ctx.entityType === 'todo' && ctx.itemPreview) {
    return 'Pendiente: «' + escHtml(ctx.itemPreview) + '»';
  }
  return entityLabel;
}

/** @param {object} ctx */
export function buildConflictPatientRef(ctx) {
  const patientName = ctx.patientDisplayName ? String(ctx.patientDisplayName) : '';
  if (patientName) return 'Paciente: ' + escHtml(patientName);
  if (ctx.patientId) return 'Paciente (id interno)';
  return '';
}

/** @param {object} ctx */
export function buildConflictCauseText(ctx) {
  if (ctx.intent === 'todo-delete') {
    return 'Quisiste eliminar este pendiente, pero la sala tiene una versión distinta (otro equipo lo editó o tu copia local estaba desactualizada).';
  }
  if (ctx.transport === 'ws') {
    return 'La sala LAN recibió un cambio en vivo (otro equipo conectado) mientras tú editabas o guardabas.';
  }
  if (ctx.transport === 'http') {
    return 'El host de la sala ya tenía una versión más reciente cuando intentaste guardar por red.';
  }
  return 'Otro guardado llegó antes que el tuyo y ambos tocaron los mismos campos.';
}

/** @param {object} ctx */
export function buildConflictVersionHtml(ctx) {
  const localV = ctx.localVersion != null && ctx.localVersion !== '' ? Number(ctx.localVersion) : null;
  const serverV = ctx.serverVersion != null && ctx.serverVersion !== '' ? Number(ctx.serverVersion) : null;
  if (localV == null && serverV == null) return '';
  const localBadge =
    localV != null && Number.isFinite(localV)
      ? '<span class="clinical-conflict-version-pill clinical-conflict-version-pill--local">Tu base: v' + escHtml(localV) + '</span>'
      : '';
  const serverBadge =
    serverV != null && Number.isFinite(serverV)
      ? '<span class="clinical-conflict-version-pill clinical-conflict-version-pill--server">Sala: v' + escHtml(serverV) + '</span>'
      : '';
  const note =
    localV != null && serverV != null && localV !== serverV
      ? '<span class="clinical-conflict-version-note">El número de versión confirma que no partiste del mismo estado.</span>'
      : '';
  return '<div class="clinical-conflict-versions">' + localBadge + serverBadge + note + '</div>';
}

/** @param {object} context */
export function buildConflictContextHtml(context) {
  const ctx = context || {};
  const lead = buildConflictLeadLine(ctx);
  const patientRef = buildConflictPatientRef(ctx);
  const cause = buildConflictCauseText(ctx);
  const versionHtml = buildConflictVersionHtml(ctx);
  const showLead = ctx.entityType !== 'historiaClinica' || !patientRef;
  return (
    '<div class="clinical-conflict-context">' +
    (showLead ? '<p class="clinical-conflict-context-lead"><strong>' + lead + '</strong></p>' : '') +
    (patientRef ? '<p class="clinical-conflict-context-patient">' + patientRef + '</p>' : '') +
    '<p class="clinical-conflict-context-body">' + escHtml(cause) + '</p>' +
    versionHtml +
    '</div>'
  );
}
