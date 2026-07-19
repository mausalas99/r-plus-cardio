import { sortLabHistoryChronological, tendEligibleSectionKey } from '../tend-core.mjs';
import { trendCatalogSeriesKey } from '../lab-history-cache.mjs';
import { bhTrendDisplayTitle, sortTrendSpecsBySomeOrder } from '../labs.js';
import {
  TEND_UNITS,
  TEND_REF,
  TEND_REF_GASES,
  TEND_SERIES_CATALOG,
  TEND_SECTION_LABELS,
} from './tendencias-constants.mjs';
import { rt } from './tendencias-runtime-state.mjs';

function toTrendAscendingSets(sets) {
  return (sets || []).slice().reverse();
}

function tendCardLabelParts(sectionKey, fieldKey) {
  var spec = tendFindSeriesSpec(sectionKey, fieldKey);
  var title = spec && spec.cardTitle ? String(spec.cardTitle) : String(fieldKey);
  var unit = tendUnitForSeries(sectionKey, fieldKey);
  if (unit === '%') {
    title = title.replace(/\s*%+\s*$/u, '').trim();
  }
  return { title: title, unit: unit };
}

var TEND_SECTION_UNIT_MAPS = {
  GASES: {
    GLU: TEND_UNITS.Glu || '',
    Na: TEND_UNITS.Na || '',
    K: TEND_UNITS.K || '',
    Hto: TEND_UNITS.Hto || '',
    Bica: TEND_UNITS.HCO3 || '',
    pCO2: 'mmHg',
    pO2: 'mmHg',
    Lactato: 'mmol/L',
    pH: '',
  },
  LCR: {
    pH: '',
    Leu: '/μL',
    Glu: TEND_UNITS.Glu || '',
    Prot: 'mg/dL',
    Cl: TEND_UNITS.Cl || '',
  },
  Liq: {
    pH: '',
    Dens: 'g/L',
    Glu: TEND_UNITS.Glu || '',
    Prot: 'mg/dL',
    LDH: TEND_UNITS.LDH || '',
    Leu: '/μL',
  },
};

function tendUnitForSeries(sectionKey, fieldKey) {
  var sectionMap = TEND_SECTION_UNIT_MAPS[sectionKey];
  if (sectionMap && fieldKey in sectionMap) return sectionMap[fieldKey];
  return TEND_UNITS[fieldKey] || '';
}

/** Rango orientativo fijo (respaldo si el reporte no trae referencia). */
function tendRefOrientative(sectionKey, fieldKey) {
  if (sectionKey === 'GASES') {
    var gg = TEND_REF_GASES[fieldKey];
    if (gg) return gg;
    if (fieldKey === 'Bica') return TEND_REF.HCO3;
    return null;
  }
  if (sectionKey === 'LCR') {
    var lr = {
      pH: TEND_REF.LCR_pH,
      Leu: TEND_REF.LCR_Leu,
      Glu: TEND_REF.LCR_Glu,
      Cl: TEND_REF.LCR_Cl,
      Prot: TEND_REF.LCR_Prot
    };
    return lr[fieldKey] || null;
  }
  if (sectionKey === 'Liq') {
    var lq = {
      pH: TEND_REF.Liq_pH,
      Glu: TEND_REF.Liq_Glu,
      Leu: TEND_REF.Liq_Leu,
      LDH: TEND_REF.Liq_LDH,
      Dens: TEND_REF.Liq_Dens,
      Prot: TEND_REF.Liq_Prot
    };
    return lq[fieldKey] || null;
  }
  return TEND_REF[fieldKey] || null;
}

function tendRefFromLabSet(set, sectionKey, fieldKey) {
  var refs = set && set.refsBySection;
  var row = refs && refs[sectionKey];
  var r = row && row[fieldKey];
  if (r && r.length === 2 && isFinite(r[0]) && isFinite(r[1]) && r[1] > r[0]) return r;
  return null;
}

/** Rango del reporte (set preferido o historial reciente); si no, orientativo. */
function tendRefForSeries(history, sectionKey, fieldKey, preferSet) {
  var fromPrefer = preferSet ? tendRefFromLabSet(preferSet, sectionKey, fieldKey) : null;
  if (fromPrefer) return fromPrefer;
  if (history && history.length) {
    var sorted = sortLabHistoryChronological(history);
    for (var i = sorted.length - 1; i >= 0; i--) {
      var r = tendRefFromLabSet(sorted[i], sectionKey, fieldKey);
      if (r) return r;
    }
  }
  return tendRefOrientative(sectionKey, fieldKey);
}

function tendParsedHistoryDesc(patientId) {
  if (rt.ensureParsedLabHistoryCached) {
    return sortLabHistoryChronological(rt.ensureParsedLabHistoryCached(patientId));
  }
  return sortLabHistoryChronological(rt.ensureParsedLabHistory(patientId));
}

function tendCatalogSeriesKey(sectionKey, fieldKey) {
  return trendCatalogSeriesKey(sectionKey, fieldKey);
}

function orderTrendSeriesBySaved(specs, savedOrder) {
  var rank = Object.create(null);
  if (savedOrder && savedOrder.length) {
    savedOrder.forEach(function (key, i) {
      rank[key] = i;
    });
  }
  var missingBase = (savedOrder && savedOrder.length ? savedOrder.length : specs.length) + 1000;
  return specs.slice().sort(function (a, b) {
    var ka = tendCatalogSeriesKey(a.sectionKey, a.fieldKey);
    var kb = tendCatalogSeriesKey(b.sectionKey, b.fieldKey);
    var ra = Object.prototype.hasOwnProperty.call(rank, ka) ? rank[ka] : missingBase;
    var rb = Object.prototype.hasOwnProperty.call(rank, kb) ? rank[kb] : missingBase;
    if (ra !== rb) return ra - rb;
    return 0;
  });
}

function tendFindSeriesSpec(sectionKey, fieldKey) {
  for (var i = 0; i < TEND_SERIES_CATALOG.length; i++) {
    if (
      TEND_SERIES_CATALOG[i].sectionKey === sectionKey &&
      TEND_SERIES_CATALOG[i].fieldKey === fieldKey
    ) {
      return TEND_SERIES_CATALOG[i];
    }
  }
  return {
    sectionKey: sectionKey,
    fieldKey: fieldKey,
    cardTitle: fieldKey + ' · ' + sectionKey
  };
}

/** Catálogo estático + pares numéricos presentes en historial y no declarados. */
function buildMergedTrendSeriesCatalog(history) {
  var mapped = Object.create(null);
  var out = [];
  function add(spec) {
    var k = tendCatalogSeriesKey(spec.sectionKey, spec.fieldKey);
    if (mapped[k]) return;
    mapped[k] = true;
    out.push(spec);
  }
  TEND_SERIES_CATALOG.forEach(function (e) {
    add({ sectionKey: e.sectionKey, fieldKey: e.fieldKey, cardTitle: e.cardTitle });
  });
  (history || []).forEach(function (set) {
    var pb = set && set.parsedBySection;
    if (!pb) return;
    Object.keys(pb).forEach(function (sk) {
      if (!tendEligibleSectionKey(sk)) return;
      var row = pb[sk];
      if (!row) return;
      Object.keys(row).forEach(function (fk) {
        var k = tendCatalogSeriesKey(sk, fk);
        if (mapped[k]) return;
        var v = row[fk];
        if (!isFinite(Number(v))) return;
        mapped[k] = true;
        out.push({
          sectionKey: sk,
          fieldKey: fk,
          cardTitle: sk === 'BH' ? bhTrendDisplayTitle(fk) : fk + ' · ' + sk,
          _dynamic: true
        });
      });
    });
  });
  return out;
}

function getTendCatalogSpecsForSection(sectionKey, history) {
  var specs = buildMergedTrendSeriesCatalog(history || []).filter(function (sp) {
    return sp.sectionKey === sectionKey;
  });
  if (sectionKey === 'BH' || sectionKey === 'QS') {
    return sortTrendSpecsBySomeOrder(sectionKey, specs);
  }
  return specs;
}

function getTendSectionLabel(sectionKey) {
  return TEND_SECTION_LABELS[sectionKey] || sectionKey;
}

function tendEyeVisibilitySvg() {
  return (
    '<svg class="tend-eye-svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
  );
}

function tendEyeHideSvg() {
  return (
    '<svg class="tend-eye-svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>' +
    '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>' +
    '<line x1="1" y1="1" x2="23" y2="23"/></svg>'
  );
}

export {
  toTrendAscendingSets,
  tendCardLabelParts,
  tendUnitForSeries,
  tendRefOrientative,
  tendRefFromLabSet,
  tendRefForSeries,
  tendParsedHistoryDesc,
  tendCatalogSeriesKey,
  orderTrendSeriesBySaved,
  tendFindSeriesSpec,
  buildMergedTrendSeriesCatalog,
  getTendCatalogSpecsForSection,
  getTendSectionLabel,
  tendEyeVisibilitySvg,
  tendEyeHideSvg,
};
