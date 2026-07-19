import {
  formatMedicamentoLine,
  normalizeMedicamentosList,
} from './medicamento-entry.mjs';
import { trim } from './string-util.mjs';


/**
 * @param {{ kind: string }} spec
 * @param {object} val
 */
export function generoFieldHasContent(spec, val) {
  if (!val || typeof val !== 'object' || val.negado === true) return false;
  switch (spec.kind) {
    case 'age':
      return trim(val.edad) !== '';
    case 'fum':
      return trim(val.fum) !== '' || trim(val.ciclo) !== '';
    case 'gpac':
      return (
        ['g', 'p', 'a', 'c'].some(function (k) {
          return trim(val[k]) !== '';
        }) || trim(val.detalle) !== ''
      );
    case 'medications':
      return normalizeMedicamentosList(val.medicamentos).some(function (m) {
        return formatMedicamentoLine(m);
      });
    case 'medication':
      return trim(val.medicacion) !== '';
    case 'detail':
      return trim(val.detalle) !== '';
    default:
      return trim(val.detalle) !== '';
  }
}
