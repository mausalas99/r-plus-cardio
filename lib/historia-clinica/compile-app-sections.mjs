import { formatFlexibleDate } from './flexible-date.mjs';
import { ERC_CONDITION_ID, formatErcConditionSuffix } from './erc-detail.mjs';
import { trim } from './string-util.mjs';


function labelsFromCatalog(ids, catalog, customConditions) {
  const custom = Array.isArray(customConditions) ? customConditions : [];
  const customMap = Object.fromEntries(custom.map((c) => [c.id, c.label]));
  return (ids || [])
    .map(function (id) {
      if (catalog && catalog[id]) return catalog[id];
      if (customMap[id]) return customMap[id];
      return id;
    })
    .filter(Boolean);
}

/**
 * @param {object} app
 * @param {Record<string,string>} catalog
 * @param {string[]} lines
 */
export function appendAppConditions(app, catalog, lines) {
  const ids = (app.conditions || []).slice();
  const custom = app.customConditions || [];
  custom.forEach(function (c) {
    if (c && c.id && ids.indexOf(c.id) < 0) ids.push(c.id);
  });

  if (!ids.length) return;

  const details = app.conditionDetails || {};
  ids.forEach(function (id) {
    let line = labelsFromCatalog([id], catalog, custom)[0] || id;
    const d = details[id];
    if (d && typeof d === 'object') {
      let suffix = '';
      if (id === ERC_CONDITION_ID) {
        suffix = formatErcConditionSuffix(d, formatFlexibleDate);
      } else {
        const parts = [];
        const when = formatFlexibleDate(d.diagnosedAt);
        if (when) parts.push('dx ' + when);
        if (trim(d.treatment)) parts.push('tto: ' + trim(d.treatment));
        suffix = parts.join('; ');
      }
      if (suffix) line += ' (' + suffix + ')';
    }
    lines.push('• ' + line);
  });
}

/**
 * @param {object} app
 * @param {string[]} lines
 */
export function appendAppAllergies(app, lines) {
  const allergyMeds = app.alergiaMedicamentos || [];
  if (app.alergiasNegado === true && !allergyMeds.length) {
    lines.push('Alergias medicamentosas: negadas.');
  } else if (allergyMeds.length) {
    lines.push(
      'Alergias medicamentosas: ' +
        allergyMeds
          .map(function (m) {
            return trim(m.medication);
          })
          .filter(Boolean)
          .join(', ')
    );
  }
}

/**
 * @param {object} app
 * @param {string[]} lines
 */
export function appendAppTraumaTransf(app, lines) {
  const trauma = app.traumaticosEntries || [];
  if (trauma.length) {
    lines.push('');
    lines.push('Antecedentes traumáticos / fracturas:');
    trauma.forEach(function (t) {
      if (!t) return;
      let row = '• ' + (trim(t.description) || 'Evento');
      const when = formatFlexibleDate(t.date);
      if (when) row += ' (' + when + ')';
      lines.push(row);
    });
  }

  const transf = app.transfusionesEntries || [];
  if (transf.length) {
    lines.push('');
    lines.push('Transfusiones:');
    transf.forEach(function (t) {
      if (!t) return;
      const parts = [];
      if (t.units != null && trim(String(t.units))) parts.push(trim(String(t.units)) + ' unidades');
      const when = formatFlexibleDate(t.date);
      if (when) parts.push(when);
      if (trim(t.adverseReactions)) parts.push('reacciones: ' + trim(t.adverseReactions));
      lines.push('• ' + (parts.length ? parts.join('; ') : 'Transfusión'));
    });
  }
}

/**
 * @param {object} app
 * @param {string[]} lines
 */
export function appendAppSurgeriesHosps(app, lines) {
  const cirugias = app.cirugias || [];
  if (cirugias.length) {
    lines.push('');
    lines.push('Cirugías:');
    cirugias.forEach(function (c) {
      if (!c) return;
      let row = '• ' + trim(c.procedure || 'Procedimiento');
      const when = formatFlexibleDate(c.date);
      if (when) row += ' — ' + when;
      if (trim(c.complications)) row += '. Complicaciones: ' + trim(c.complications);
      lines.push(row);
    });
  }

  const hosps = app.hospitalizaciones || [];
  if (hosps.length) {
    lines.push('');
    lines.push('Hospitalizaciones:');
    hosps.forEach(function (h) {
      if (!h) return;
      let row = '• ' + trim(h.reason || 'Motivo');
      const when = formatFlexibleDate(h.date);
      if (when) row += ' — ' + when;
      if (trim(h.duration)) row += '. Duración: ' + trim(h.duration);
      if (trim(h.complications)) row += '. Complicaciones: ' + trim(h.complications);
      lines.push(row);
    });
  }
}

/**
 * @param {object} app
 * @param {object} hospsRef — hospitalizaciones array reference for legacy check
 * @param {string[]} lines
 */
export function appendAppMedsAndText(app, hospsRef, lines) {
  if (trim(app.descripcionDetallada)) {
    lines.push('');
    lines.push(trim(app.descripcionDetallada));
  }

  if (trim(app.inmunizaciones)) lines.push('Inmunizaciones: ' + trim(app.inmunizaciones));

  const currentMeds = app.medicamentosActuales || [];
  if (currentMeds.length) {
    lines.push('');
    lines.push('Medicamentos actuales:');
    currentMeds.forEach(function (m) {
      if (!m) return;
      const name = trim(m.medication);
      if (!name) return;
      const parts = [name];
      if (trim(m.route)) parts.push('vía ' + trim(m.route));
      if (trim(m.dosage)) parts.push(trim(m.dosage));
      if (trim(m.frequency)) parts.push(trim(m.frequency));
      lines.push('• ' + parts.join(', '));
    });
  }

  if (trim(app.hospitalizacionesPrevias) && !hospsRef.length) {
    lines.push('Hospitalizaciones (texto): ' + trim(app.hospitalizacionesPrevias));
  }
}
