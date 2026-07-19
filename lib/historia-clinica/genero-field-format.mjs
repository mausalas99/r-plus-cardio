import {
  formatMedicamentoLine,
  normalizeMedicamentosList,
} from './medicamento-entry.mjs';
import { generoFieldHasContent } from './genero-field-shared.mjs';
import { trim } from './string-util.mjs';


/**
 * @param {{ id: string, label: string, kind: string }} spec
 * @param {object} val
 */
export function formatGeneroAgeLine(spec, val) {
  return spec.label + ': ' + trim(val.edad) + ' años';
}

/**
 * @param {{ label: string }} spec
 * @param {object} val
 */
export function formatGeneroFumLine(spec, val) {
  const parts = [];
  if (trim(val.fum)) parts.push('FUM ' + trim(val.fum));
  if (trim(val.ciclo)) parts.push(trim(val.ciclo));
  return spec.label + ': ' + parts.join('; ');
}

/**
 * @param {{ label: string }} spec
 * @param {object} val
 */
export function formatGeneroGpacLine(spec, val) {
  if (trim(val.detalle)) return spec.label + ': ' + trim(val.detalle);
  const g = trim(val.g) || '0';
  const p = trim(val.p) || '0';
  const a = trim(val.a) || '0';
  const c = trim(val.c) || '0';
  return spec.label + ': G' + g + ' P' + p + ' A' + a + ' C' + c;
}

/**
 * @param {{ label: string }} spec
 * @param {object} val
 */
export function formatGeneroMedsLine(spec, val) {
  const meds = normalizeMedicamentosList(val.medicamentos);
  const lines = meds.map(formatMedicamentoLine).filter(Boolean);
  if (!lines.length) return '';
  return (
    spec.label +
    ':\n' +
    lines
      .map(function (l) {
        return '• ' + l;
      })
      .join('\n')
  );
}

/**
 * @param {{ id: string, label: string, kind: string }} spec
 * @param {object} val
 */
export function formatGeneroFieldLine(spec, val) {
  if (!generoFieldHasContent(spec, val)) return '';
  switch (spec.kind) {
    case 'age':
      return formatGeneroAgeLine(spec, val);
    case 'fum':
      return formatGeneroFumLine(spec, val);
    case 'gpac':
      return formatGeneroGpacLine(spec, val);
    case 'medications':
    case 'medication':
      return formatGeneroMedsLine(spec, val);
    case 'detail':
      return spec.label + ': ' + trim(val.detalle);
    default:
      return '';
  }
}
