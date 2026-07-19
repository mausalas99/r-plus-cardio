import appConditions from '../historia-clinica/catalogs/app-conditions.json' with { type: 'json' };
import ahfConditions from '../historia-clinica/catalogs/ahf-conditions.json' with { type: 'json' };
import { AHF_RELATIVES } from '../historia-clinica/ahf-relatives.mjs';
import {
  isNegatedDriveText,
  parseAppSubsections,
  matchCatalogConditions,
  parseMedicamentosList,
  parseAhfRelativeLines,
  matchToxicomaniasSubstances,
} from './hc-structured-patterns.mjs';

const APP_ENTRY_SPECS = [
  { subKey: 'transfusiones', target: 'app.transfusionesEntries', prefix: 'Transfusión' },
  { subKey: 'hospitalizaciones', target: 'app.hospitalizaciones', prefix: 'Hospitalización' },
  { subKey: 'cirugias', target: 'app.cirugias', prefix: 'Cirugía' },
  { subKey: 'traumaticos', target: 'app.traumaticosEntries', prefix: 'Traumatismo' },
];

function pushAppConditionSuggestions(suggestions, diseaseText) {
  matchCatalogConditions(diseaseText, appConditions).forEach(function (cond) {
    suggestions.push({
      id: 'app_cond_' + cond.id,
      label: cond.label,
      target: 'app.conditions',
      include: true,
      value: cond.id,
      sourceText: cond.label,
    });
  });
}

function pushMedicamentoSuggestions(suggestions, medText) {
  parseMedicamentosList(medText).forEach(function (med, idx) {
    suggestions.push({
      id: 'app_med_' + idx,
      label: 'Medicamento: ' + med.medication,
      target: 'app.medicamentosActuales',
      include: true,
      value: med,
      sourceText: med.medication,
    });
  });
}

function pushAlergiaSuggestions(suggestions, alergiasText) {
  if (!alergiasText) return;
  if (isNegatedDriveText(alergiasText)) {
    suggestions.push({
      id: 'app_alergias_negado',
      label: 'Sin alergias medicamentosas conocidas',
      target: 'app.alergiasNegado',
      include: true,
      value: true,
      sourceText: alergiasText,
    });
    return;
  }
  alergiasText
    .split(/\s*,\s*/)
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean)
    .forEach(function (med, idx) {
      suggestions.push({
        id: 'app_alergia_' + idx,
        label: 'Alergia: ' + med,
        target: 'app.alergiaMedicamentos',
        include: true,
        value: { id: 'drv_al_' + idx, medication: med },
        sourceText: med,
      });
    });
}

function pushInmunizacionSuggestion(suggestions, inmunText) {
  if (!inmunText || isNegatedDriveText(inmunText)) return;
  suggestions.push({
    id: 'app_inmunizaciones',
    label: 'Inmunizaciones: ' + inmunText.slice(0, 72) + (inmunText.length > 72 ? '…' : ''),
    target: 'app.inmunizaciones',
    include: true,
    value: inmunText,
    sourceText: inmunText,
  });
}

function pushAppEntrySuggestions(suggestions, subs) {
  APP_ENTRY_SPECS.forEach(function (spec) {
    const body = subs[spec.subKey] || '';
    if (!body || isNegatedDriveText(body)) return;
    suggestions.push({
      id: 'app_' + spec.subKey,
      label: spec.prefix + ': ' + body.slice(0, 72) + (body.length > 72 ? '…' : ''),
      target: spec.target,
      include: true,
      value: body,
      sourceText: body,
    });
  });
}

/** @param {string} key @param {string} text @param {HcStructuredSuggestion[]} suggestions */
export function buildAppSectionSuggestions(key, text, suggestions) {
  if (key !== 'app' && key !== 'ecd' && key !== 'medicamentos') return;
  const subs = parseAppSubsections(text);
  const diseaseText = [subs.ecd, subs.enfermedades, subs._body, text].filter(Boolean).join('\n');
  pushAppConditionSuggestions(suggestions, diseaseText);
  const medText = subs.medicamentos || (key === 'medicamentos' ? text : '');
  pushMedicamentoSuggestions(suggestions, medText);
  pushAlergiaSuggestions(suggestions, subs.alergias || '');
  pushInmunizacionSuggestion(suggestions, subs.inmunizaciones || '');
  pushAppEntrySuggestions(suggestions, subs);
}

/** @param {string} text @param {HcStructuredSuggestion[]} suggestions */
export function buildApnpSectionSuggestions(text, suggestions) {
  String(text || '')
    .split('\n')
    .forEach(function (raw) {
      const line = raw.trim();
      const m = /^([A-ZÁÉÍÓÚÑ0-9\s]+)\s*[:;]\s*(.+)$/i.exec(line);
      if (!m) return;
      const label = m[1].trim().toUpperCase();
      const value = m[2].trim();
      if (label === 'TABAQUISMO' && isNegatedDriveText(value)) {
        suggestions.push({
          id: 'apnp_tabaquismo_negado',
          label: 'Tabaquismo negado',
          target: 'apnp.tabaquismoDetail',
          include: true,
          value: { status: 'negado' },
          sourceText: value,
        });
      }
      if ((label === 'ETILISMO' || label === 'ALCOHOLISMO') && isNegatedDriveText(value)) {
        suggestions.push({
          id: 'apnp_alcoholismo_negado',
          label: 'Alcoholismo negado',
          target: 'apnp.alcoholismoDetail',
          include: true,
          value: { status: 'negado' },
          sourceText: value,
        });
      }
      if (label === 'TOXICOMANÍAS' || label === 'TOXICOMANIAS') {
        if (isNegatedDriveText(value)) return;
        matchToxicomaniasSubstances(value).forEach(function (sub) {
          suggestions.push({
            id: 'apnp_tox_' + sub.id,
            label: 'Toxicomanía: ' + sub.label,
            target: 'apnp.toxicomaniasEntries',
            include: true,
            value: {
              id: 'drv_tox_' + sub.id,
              substanceId: sub.id,
              customLabel: '',
              frequency: '',
              years: '',
            },
            sourceText: sub.label,
          });
        });
      }
    });
}

/** @param {string} text @param {HcStructuredSuggestion[]} suggestions */
export function buildAhfSectionSuggestions(text, suggestions) {
  parseAhfRelativeLines(text).forEach(function (entry) {
    const relLabel =
      (AHF_RELATIVES.find(function (r) {
        return r.id === entry.relativeId;
      }) || {}).label || entry.relativeId;
    suggestions.push({
      id: entry.id,
      label: relLabel + ': ' + String(entry.diagnosis || '').slice(0, 64),
      target: 'ahf.entries',
      include: true,
      value: entry,
      sourceText: entry.diagnosis,
    });
  });
  matchCatalogConditions(text, ahfConditions).forEach(function (cond) {
    if (
      suggestions.some(function (s) {
        return s.target === 'ahf.entries' && s.value && s.value.conditionId === cond.id;
      })
    ) {
      return;
    }
    suggestions.push({
      id: 'ahf_cond_' + cond.id,
      label: 'Antecedente familiar: ' + cond.label,
      target: 'ahf.conditions',
      include: true,
      value: cond.id,
      sourceText: cond.label,
    });
  });
}

/** @param {string} key @param {string} text @param {HcStructuredSuggestion[]} suggestions */
export function appendFallbackSectionSuggestions(key, text, suggestions) {
  if (key === 'ecd' && !suggestions.length) {
    pushAppConditionSuggestions(suggestions, text);
  }
  if (
    key === 'medicamentos' &&
    !suggestions.some(function (s) {
      return s.target === 'app.medicamentosActuales';
    })
  ) {
    pushMedicamentoSuggestions(suggestions, text);
  }
}
