/** Cache revision fingerprint for EA monitoreo (historial + estado clínico + receta). */
import { MED_FIELD_KEYS } from './estado-actual-data-constants.mjs';

/**
 * @param {string[]} parts
 * @param {unknown[]} historial
 */
function appendHistorialRevision(parts, historial) {
  var h = historial.length;
  parts.push('h' + h);
  for (var i = 0; i < Math.min(4, h); i += 1) {
    var row = historial[i];
    parts.push(String(row && row.id ? row.id : '') + '@' + String(row && row.recordedAt ? row.recordedAt : ''));
  }
}

/**
 * @param {string[]} parts
 * @param {Record<string, unknown>} ec
 * @param {Record<string, unknown>} pend
 * @param {Record<string, unknown>} conf
 */
function appendEstadoClinicoRevision(parts, ec, pend, conf) {
  parts.push(
    String(ec.four || ''),
    String(ec.esferas || ''),
    String(ec.soporte || ''),
    String(ec.dieta || ''),
    String(ec.kcalKg || ''),
    String(ec.kcal || ''),
    String(ec.proteinG || '')
  );
  for (var dk of ['dieta', 'kcal', 'proteinG']) {
    parts.push(String(pend[dk] || ''), conf[dk] ? '1' : '0');
  }
  for (var k of MED_FIELD_KEYS) {
    parts.push(String(ec[k] || ''), String(pend[k] || ''), conf[k] ? '1' : '0');
  }
}

/**
 * @param {string[]} parts
 * @param {{ fechaActualizacion?: unknown, dietas?: unknown[], items?: unknown[] } | null} block
 */
function dietRevisionToken(di) {
  return (
    String(di && di.descripcionRaw ? di.descripcionRaw : '') +
    '@' +
    String(di && di.kcal != null ? di.kcal : '') +
    '@' +
    String(di && di.proteinG != null ? di.proteinG : '')
  );
}

function itemRevisionToken(it) {
  return String(it && it.id ? it.id : '') + (it && it.suspendido ? 's' : 'a');
}

function appendRecetaRevision(parts, block) {
  var dietas = block && Array.isArray(block.dietas) ? block.dietas : [];
  var items = block && Array.isArray(block.items) ? block.items : [];
  parts.push('f' + String(block && block.fechaActualizacion ? block.fechaActualizacion : ''));
  parts.push('d' + dietas.length);
  for (var d = 0; d < Math.min(2, dietas.length); d += 1) {
    parts.push(dietRevisionToken(dietas[d]));
  }
  parts.push('r' + items.length);
  for (var j = 0; j < Math.min(4, items.length); j += 1) {
    parts.push(itemRevisionToken(items[j]));
  }
}

function appendCalendarDay(parts) {
  var now = new Date();
  parts.push(
    'cal' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
  );
}

/**
 * @param {unknown} monitoreoLike
 * @param {string | null | undefined} activeId
 * @param {Record<string, { items?: Array<{ id?: string, suspendido?: boolean }>, dietas?: unknown[], fechaActualizacion?: unknown }>} [medRecetaByPatient]
 * @returns {string}
 */
export function buildEaMonitoreoRevision(monitoreoLike, activeId, medRecetaByPatient) {
  /** @type {any} */
  var m = monitoreoLike || {};
  var hist = Array.isArray(m.historial) ? m.historial : [];
  var parts = [];
  appendHistorialRevision(parts, hist);
  var tg = m.textoGuardado && m.textoGuardado.savedAt != null ? String(m.textoGuardado.savedAt) : '';
  parts.push('t' + tg);
  parts.push('bi' + String(m.bombaInsulinaAlgoritmo != null ? m.bombaInsulinaAlgoritmo : ''));
  var ec = m.estadoClinico && typeof m.estadoClinico === 'object' ? m.estadoClinico : {};
  var pend = m.pendienteReceta && typeof m.pendienteReceta === 'object' ? m.pendienteReceta : {};
  var conf = m.confirmado && typeof m.confirmado === 'object' ? m.confirmado : {};
  appendEstadoClinicoRevision(parts, ec, pend, conf);
  var block = activeId && medRecetaByPatient ? medRecetaByPatient[activeId] : null;
  appendRecetaRevision(parts, block);
  appendCalendarDay(parts);
  return parts.join(':');
}
