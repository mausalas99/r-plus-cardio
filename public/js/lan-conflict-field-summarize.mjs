/** Primitive + array summaries for LAN conflict field display. */
import { formatFieldLabel } from './lan-conflict-labels.mjs';

export function trimCollapse(text, maxLen) {
  const max = maxLen == null ? 140 : maxLen;
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

export function summarizeEntryRow(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const bits = [];
  if (entry.descripcionDetallada) bits.push(trimCollapse(entry.descripcionDetallada, 90));
  if (entry.diagnosis) bits.push('dx: ' + trimCollapse(entry.diagnosis, 50));
  if (entry.treatment) bits.push('tto: ' + trimCollapse(entry.treatment, 50));
  if (entry.description) bits.push(trimCollapse(entry.description, 60));
  if (entry.medication) bits.push(trimCollapse(entry.medication, 40));
  if (entry.relativeId && !bits.length) bits.push('familiar ' + String(entry.relativeId));
  return bits.join(' · ');
}

export function summarizeIpasBlock(ipas) {
  if (!ipas || typeof ipas !== 'object') return '';
  const lines = [];
  for (const block of Object.values(ipas)) {
    if (!block || typeof block !== 'object') continue;
    const desc = trimCollapse(block.descripcion, 72);
    const checks = Array.isArray(block.checks) ? block.checks.length : 0;
    if (desc && desc.toLowerCase() !== 'interrogado y negado') {
      lines.push(desc);
    } else if (checks > 0) {
      lines.push(checks + ' hallazgo' + (checks === 1 ? '' : 's'));
    }
    if (lines.length >= 2) break;
  }
  if (!lines.length) return 'interrogado y negado';
  return lines.join(' · ');
}

export function summarizeScalarValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return trimCollapse(value) || '—';
      }
    }
    const t = trimCollapse(value);
    return t || '—';
  }
  if (typeof value !== 'object') return String(value);
  return null;
}

export function summarizeArrayValue(value) {
  if (!Array.isArray(value) || !value.length) return 'vacío';
  const previews = value
    .slice(0, 2)
    .map((item) => (typeof item === 'object' ? summarizeEntryRow(item) : trimCollapse(item, 60)))
    .filter(Boolean);
  const tail = value.length > 2 ? ' (+' + (value.length - 2) + ' más)' : '';
  return (previews.length ? previews.join('; ') : value.length + ' elemento' + (value.length === 1 ? '' : 's')) + tail;
}

function appendGeneroParts(value, parts) {
  for (const gKey of ['menarquia', 'gestas', 'partos', 'cesareas', 'abortos', 'notas', 'ultimaMenstruacion']) {
    if (value[gKey] != null && String(value[gKey]).trim()) {
      parts.push(formatFieldLabel(gKey) + ': ' + trimCollapse(value[gKey], 40));
    }
  }
}

function appendIdentificacionParts(value, parts) {
  const idBits = ['lugarNacimiento', 'residencia', 'ocupacionActual', 'dx', 'cama']
    .map((k) => (value[k] ? formatFieldLabel(k) + ': ' + trimCollapse(value[k], 35) : ''))
    .filter(Boolean);
  if (idBits.length) parts.push(idBits.slice(0, 3).join(' · '));
}

function appendHabitParts(value, parts) {
  for (const habitKey of ['tabaquismo', 'alcoholismo', 'toxicomanias', 'dieta', 'tatuajes', 'deportesPasatiemposMascotas']) {
    if (value[habitKey] && String(value[habitKey]).trim()) {
      parts.push(trimCollapse(value[habitKey], 55));
    }
  }
  if (value.medicamentosActuales && String(value.medicamentosActuales).trim()) {
    parts.push('Meds: ' + trimCollapse(value.medicamentosActuales, 70));
  }
  if (value.hospitalizacionesPrevias && String(value.hospitalizacionesPrevias).trim()) {
    parts.push('Hosp. prev.: ' + trimCollapse(value.hospitalizacionesPrevias, 60));
  }
}

function appendEntriesParts(value, parts) {
  const entries = value.entries;
  if (!Array.isArray(entries) || !entries.length) return;
  const rowText = entries
    .slice(0, 3)
    .map(summarizeEntryRow)
    .filter(Boolean)
    .join('; ');
  if (rowText) parts.push(rowText);
  if (entries.length > 3) {
    parts.push('+' + (entries.length - 3) + ' registro' + (entries.length - 3 === 1 ? '' : 's'));
  }
}

/** @param {string} key @param {object} value */
export function summarizeObjectFieldValue(key, value) {
  if (key === 'ipas') return summarizeIpasBlock(value) || '—';

  const parts = [];
  const desc = value.descripcionDetallada || value.descripcion;
  if (desc && String(desc).trim()) parts.push(trimCollapse(desc, 110));

  appendEntriesParts(value, parts);

  const condCount = Array.isArray(value.conditions) ? value.conditions.length : 0;
  if (condCount && !value.entries?.length) {
    parts.push(condCount + ' condición' + (condCount === 1 ? '' : 'es'));
  }

  appendHabitParts(value, parts);
  if (key === 'genero') appendGeneroParts(value, parts);
  if (key === 'identificacion') appendIdentificacionParts(value, parts);

  return parts;
}
