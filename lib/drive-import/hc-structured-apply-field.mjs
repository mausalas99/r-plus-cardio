import { HC_INTERROGADO_NEGADO } from '../historia-clinica/defaults.mjs';

/** @typedef {(block: Record<string, unknown>, s: HcStructuredSuggestion) => void} PatchFieldHandler */

/** @type {Record<string, PatchFieldHandler>} */
const PATCH_FIELD_HANDLERS = {
  conditions(block, s) {
    const list = Array.isArray(block.conditions) ? block.conditions.slice() : [];
    const id = String(s.value);
    if (id && list.indexOf(id) < 0) list.push(id);
    block.conditions = list;
  },
  medicamentosActuales(block, s) {
    const list = Array.isArray(block.medicamentosActuales) ? block.medicamentosActuales.slice() : [];
    const med = /** @type {{ medication?: string }} */ (s.value);
    if (
      med &&
      med.medication &&
      !list.some(function (row) {
        return String(row.medication || '').toUpperCase() === String(med.medication).toUpperCase();
      })
    ) {
      list.push(s.value);
    }
    block.medicamentosActuales = list;
  },
  alergiasNegado(block, s) {
    block.alergiasNegado = !!s.value;
    if (block.alergiasNegado) block.alergiaMedicamentos = [];
  },
  alergiaMedicamentos(block, s) {
    block.alergiasNegado = false;
    const list = Array.isArray(block.alergiaMedicamentos) ? block.alergiaMedicamentos.slice() : [];
    const row = /** @type {{ medication?: string }} */ (s.value);
    if (row && row.medication) list.push(s.value);
    block.alergiaMedicamentos = list;
  },
  inmunizaciones(block, s) {
    if (!String(block.inmunizaciones || '').trim()) {
      block.inmunizaciones = String(s.value || '').trim();
    }
  },
  transfusionesEntries(block, s) {
    const list = Array.isArray(block.transfusionesEntries) ? block.transfusionesEntries.slice() : [];
    list.push({
      id: 'drv_tf_' + list.length,
      units: '',
      adverseReactions: String(s.value || '').trim(),
      date: null,
    });
    block.transfusionesEntries = list;
  },
  hospitalizaciones(block, s) {
    const list = Array.isArray(block.hospitalizaciones) ? block.hospitalizaciones.slice() : [];
    list.push({
      reason: String(s.value || '').trim(),
      duration: '',
      complications: '',
      date: null,
    });
    block.hospitalizaciones = list;
  },
  cirugias(block, s) {
    const list = Array.isArray(block.cirugias) ? block.cirugias.slice() : [];
    list.push({
      procedure: String(s.value || '').trim(),
      complications: '',
      date: null,
    });
    block.cirugias = list;
  },
  traumaticosEntries(block, s) {
    const list = Array.isArray(block.traumaticosEntries) ? block.traumaticosEntries.slice() : [];
    list.push({
      id: 'drv_tr_' + list.length,
      description: String(s.value || '').trim(),
      date: null,
    });
    block.traumaticosEntries = list;
  },
  tabaquismoDetail(block, s) {
    block.tabaquismoDetail = Object.assign({}, block.tabaquismoDetail || {}, s.value || {});
    block.tabaquismo = HC_INTERROGADO_NEGADO;
  },
  alcoholismoDetail(block, s) {
    block.alcoholismoDetail = Object.assign({}, block.alcoholismoDetail || {}, s.value || {});
    block.alcoholismo = HC_INTERROGADO_NEGADO;
  },
  toxicomaniasEntries(block, s) {
    const list = Array.isArray(block.toxicomaniasEntries) ? block.toxicomaniasEntries.slice() : [];
    const row = /** @type {{ substanceId?: string }} */ (s.value);
    if (
      row &&
      row.substanceId &&
      !list.some(function (entry) {
        return entry && entry.substanceId === row.substanceId;
      })
    ) {
      list.push(s.value);
    }
    block.toxicomaniasEntries = list;
  },
  entries(block, s) {
    const list = Array.isArray(block.entries) ? block.entries.slice() : [];
    const row = /** @type {{ id?: string, relativeId?: string, conditionId?: string, diagnosis?: string }} */ (
      s.value
    );
    if (
      row &&
      row.relativeId &&
      row.conditionId &&
      !list.some(function (entry) {
        return (
          entry &&
          entry.relativeId === row.relativeId &&
          entry.conditionId === row.conditionId &&
          String(entry.diagnosis || '').toUpperCase() === String(row.diagnosis || '').toUpperCase()
        );
      })
    ) {
      list.push(s.value);
    }
    block.entries = list;
  },
};

/**
 * @param {Record<string, unknown>} out
 * @param {HcStructuredSuggestion} s
 * @returns {Record<string, unknown>}
 */
export function applyStructuredSuggestionToPatch(out, s) {
  const parts = String(s.target || '').split('.');
  if (parts.length !== 2) return out;
  const section = parts[0];
  const field = parts[1];
  if (!out[section] || typeof out[section] !== 'object') {
    out[section] = {};
  }
  const block = /** @type {Record<string, unknown>} */ (Object.assign({}, out[section]));
  const handler = PATCH_FIELD_HANDLERS[field];
  if (handler) handler(block, s);
  out[section] = block;
  return out;
}
