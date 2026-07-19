// Pase board cultivo antibiogram blocks
import { labHistory } from '../../app-state.mjs';
import {
  buildAtbRisSummaryHtml,
  extractSensCrudasForGermFromSource,
} from '../../labs.js';
import { esc } from './expediente-runtime.mjs';

function formatPaseCultivoResistenciasHtml(raw) {
  var t = esc(String(raw || ''));
  t = t.replace(/\bR:/g, '<span class="pase-atb-tag pase-atb-tag--r">R:</span>');
  t = t.replace(/\bI:/g, '<span class="pase-atb-tag pase-atb-tag--i">I:</span>');
  t = t.replace(/\bS:/g, '<span class="pase-atb-tag pase-atb-tag--s">S:</span>');
  return t;
}

function paseCultivoAtbBlockHtml(patientId, r) {
  var sets = labHistory[patientId] || [];
  var set = sets.find(function (s) {
    return String(s.id) === String(r.labSetId);
  });
  var sens =
    set && set.sourceText ? extractSensCrudasForGermFromSource(set.sourceText, r.organismo) : null;
  if (sens && sens.length) {
    return (
      '<div class="pase-cult-atb-wrap">' +
      '<div class="cultivos-atb-chips pase-cult-atb-chips" role="list">' +
      buildAtbRisSummaryHtml(sens) +
      '</div></div>'
    );
  }
  var resH =
    r.resistencias && String(r.resistencias).trim()
      ? '<div class="pase-cult-atb">' + formatPaseCultivoResistenciasHtml(r.resistencias) + '</div>'
      : '';
  if (resH) {
    return '<div class="pase-cult-atb-wrap">' + resH + '</div>';
  }
  return '';
}

export { formatPaseCultivoResistenciasHtml, paseCultivoAtbBlockHtml };
