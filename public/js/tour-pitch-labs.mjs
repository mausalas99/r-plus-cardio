/**
 * Labs de tendencia y cultivos para el paciente demo-pitch del tour.
 */
import { procesarLabs } from './labs.js';
import { extractParsedValues } from './features/diagrams-parse.mjs';
import { DEMO_SOME_LAB_REPORT, OLDER_DEMO_SOME_LAB_REPORT } from './tour-demo-some-lab.mjs';
import { PITCH_CULTIVO_LAB_SPECS } from './tour-pitch-cultivos-some.mjs';
import { PITCH_DEMO_PATIENT_ID } from './tour-pitch-sandbox.mjs';
import { bumpLabHistoryRevision } from './lab-history-cache.mjs';

/** @param {{ id: string, fecha: string, report: string }} spec */
export function buildPitchLabHistoryEntry(spec) {
  const resLabs = procesarLabs(spec.report).resLabs;
  return {
    id: spec.id,
    fecha: spec.fecha,
    hora: '',
    resLabs,
    parsed: extractParsedValues(resLabs),
    sourceText: spec.report,
  };
}

export function getPitchCultivoParseText() {
  return PITCH_CULTIVO_LAB_SPECS[0].report;
}

export function reconcilePitchCultivoHistory(labHistoryMap) {
  const pid = PITCH_DEMO_PATIENT_ID;
  const list = Array.isArray(labHistoryMap[pid]) ? labHistoryMap[pid].slice() : [];
  const byId = Object.create(null);
  list.forEach(function (entry) {
    if (entry && entry.id) byId[entry.id] = entry;
  });
  PITCH_CULTIVO_LAB_SPECS.forEach(function (spec) {
    byId[spec.id] = buildPitchLabHistoryEntry(spec);
  });
  labHistoryMap[pid] = Object.keys(byId).map(function (id) {
    return byId[id];
  });
  bumpLabHistoryRevision(pid);
}

/** Labs de tendencia + cultivos multipaciente en historial (con sourceText para S/I/R). */
export function buildPitchLabHistoryEntries() {
  const trendSpecs = [
    { id: 'pitch-lab-trend-1', fecha: '01/05/2026', report: OLDER_DEMO_SOME_LAB_REPORT },
    { id: 'pitch-lab-trend-2', fecha: '04/05/2026', report: DEMO_SOME_LAB_REPORT },
    { id: 'pitch-lab-trend-3', fecha: '06/05/2026', report: OLDER_DEMO_SOME_LAB_REPORT },
    { id: 'pitch-lab-trend-4', fecha: '08/05/2026', report: DEMO_SOME_LAB_REPORT },
    { id: 'pitch-lab-trend-5', fecha: '10/05/2026', report: OLDER_DEMO_SOME_LAB_REPORT },
  ];
  const out = trendSpecs.map(buildPitchLabHistoryEntry);
  PITCH_CULTIVO_LAB_SPECS.forEach(function (spec) {
    out.push(buildPitchLabHistoryEntry(spec));
  });
  return out;
}
