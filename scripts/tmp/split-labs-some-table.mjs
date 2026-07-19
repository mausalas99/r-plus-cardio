#!/usr/bin/env node
/**
 * Split labs-some-table.mjs into submodules (debt campaign).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public/js');
const srcPath = path.join(ROOT, 'labs-some-table.mjs');
const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function write(name, body) {
  const p = path.join(ROOT, name);
  fs.writeFileSync(p, body.endsWith('\n') ? body : `${body}\n`);
  console.log(name, fs.readFileSync(p, 'utf8').split('\n').length, 'lines');
}

write(
  'labs-some-table-helpers.mjs',
  `/** SOME table parse helpers — line classification, flags, metadata. */

${slice(8, 348)}

export {
  SOME_DEPARTMENTS,
  DEPT_RE,
  FLATTEN_DEPT_KEYS,
  CITO_GROUP_RE,
  CULTURE_FIELD_RE,
  normLine,
  cleanValue,
  cleanEstudio,
  isTableHeaderLine,
  isDepartmentLine,
  departmentKey,
  isFlagToken,
  isAbnormalFlag,
  normalizeDeptKey,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  isCitoGroupTitle,
  isSectionDividerEstudio,
  skipSectionDividerBlock,
  isCultureGroupTitle,
  pruneSomeCultureRows,
  pruneSomeRows,
  isSectionDividerRow,
  isMetadataLine,
  stripSomeInlineMetadata,
  lineHasSomeMetadata,
  isStudyRowHeader,
  isSerumQcAnalyte,
  isLikelyGroupTitle,
  stripCommentNoiseFromDepartment,
  looksLikeReferenceValue,
  looksLikeQualitativeResult,
  looksLikeUnitsRefLine,
  parseUnitsRef,
  isCultureFieldLine,
  isCultureSampleTitle,
};
`
);

// Fix helpers - SOME_DEPARTMENTS and DEPT_RE need export on const
let helpers = fs.readFileSync(path.join(ROOT, 'labs-some-table-helpers.mjs'), 'utf8');
helpers = helpers.replace(/^export const SOME_DEPARTMENTS/m, 'const SOME_DEPARTMENTS');
helpers = helpers.replace(/^const DEPT_RE/m, 'const DEPT_RE');
helpers = helpers.replace(/^const FLATTEN_DEPT_KEYS/m, 'const FLATTEN_DEPT_KEYS');
helpers = helpers.replace(/^const CITO_GROUP_RE/m, 'const CITO_GROUP_RE');
helpers = helpers.replace(/^var CULTURE_FIELD_RE/m, 'const CULTURE_FIELD_RE');
fs.writeFileSync(path.join(ROOT, 'labs-some-table-helpers.mjs'), helpers);

write(
  'labs-some-table-row.mjs',
  `/** SOME table row readers — standard rows + bacteriología culture blocks. */
import {
  cleanEstudio,
  cleanValue,
  isTableHeaderLine,
  isDepartmentLine,
  isFlagToken,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  isSectionDividerEstudio,
  isCitoGroupTitle,
  isCultureFieldLine,
  isCultureSampleTitle,
  isAbnormalFlag,
  lineHasSomeMetadata,
  stripSomeInlineMetadata,
  looksLikeUnitsRefLine,
  looksLikeReferenceValue,
  isLikelyGroupTitle,
  parseUnitsRef,
  CULTURE_FIELD_RE,
} from './labs-some-table-helpers.mjs';

${slice(350, 578)}

export {
  cultureBlockEndIdx,
  readCultureSomeRowAt,
  parseBacteriologiaCultureGroup,
  finalizeRow,
  readRowAt,
};
`
);

write(
  'labs-some-table-normalize.mjs',
  `/** SOME table group/dept normalization and flattening. */
import {
  isCitoGroupTitle,
  isSectionDividerRow,
  isCultureGroupTitle,
  normalizeDeptKey,
  pruneSomeCultureRows,
  pruneSomeRows,
  FLATTEN_DEPT_KEYS,
} from './labs-some-table-helpers.mjs';

${slice(658, 745)}

export {
  normalizeSomeGroup,
  flattenDeptGroupsSimple,
  extractFluidSourceFromRows,
  flattenQuimicaClinica,
  flattenDeptGroups,
};
`
);

write(
  'labs-some-table-parse.mjs',
  `/** SOME report table parser entry. */
import { dispatchSomeParseLine, finalizeSomeDepartments } from './labs-some-table-parse-loop.mjs';
import {
  cleanEstudio,
  isMetadataLine,
  isDepartmentLine,
  departmentKey,
  isTableHeaderLine,
  normalizeDeptKey,
  isCultureSampleTitle,
  parseBacteriologiaCultureGroup,
  isSectionDividerRow,
  isSectionDividerEstudio,
  skipSectionDividerBlock,
  isFlagToken,
  isCitoGroupTitle,
  CITO_GROUP_RE,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  readRowAt,
  isLikelyGroupTitle,
  FLATTEN_DEPT_KEYS,
  isStudyRowHeader,
  isSerumQcAnalyte,
  stripCommentNoiseFromDepartment,
} from './labs-some-table-helpers.mjs';
import { parseBacteriologiaCultureGroup as parseCultureGroup, readRowAt as readSomeRowAt } from './labs-some-table-row.mjs';
import {
  normalizeSomeGroup,
  flattenDeptGroups,
  stripCommentNoiseFromDepartment as stripDeptNoise,
} from './labs-some-table-normalize.mjs';

${slice(584, 656)
  .replace(/parseBacteriologiaCultureGroup/g, 'parseCultureGroup')
  .replace(/\breadRowAt\b/g, 'readSomeRowAt')
  .replace(/stripCommentNoiseFromDepartment/g, 'stripDeptNoise')}
`
);

// Fix parse imports - duplicate parseBacteriologiaCultureGroup and readRowAt
let parseBody = fs.readFileSync(path.join(ROOT, 'labs-some-table-parse.mjs'), 'utf8');
parseBody = parseBody.replace(
  `import {
  cleanEstudio,
  isMetadataLine,
  isDepartmentLine,
  departmentKey,
  isTableHeaderLine,
  normalizeDeptKey,
  isCultureSampleTitle,
  parseBacteriologiaCultureGroup,
  isSectionDividerRow,
  isSectionDividerEstudio,
  skipSectionDividerBlock,
  isFlagToken,
  isCitoGroupTitle,
  CITO_GROUP_RE,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  readRowAt,
  isLikelyGroupTitle,
  FLATTEN_DEPT_KEYS,
  isStudyRowHeader,
  isSerumQcAnalyte,
  stripCommentNoiseFromDepartment,
} from './labs-some-table-helpers.mjs';
import { parseBacteriologiaCultureGroup as parseCultureGroup, readRowAt as readSomeRowAt } from './labs-some-table-row.mjs';
import {
  normalizeSomeGroup,
  flattenDeptGroups,
  stripCommentNoiseFromDepartment as stripDeptNoise,
} from './labs-some-table-normalize.mjs';`,
  `import {
  cleanEstudio,
  isMetadataLine,
  isDepartmentLine,
  departmentKey,
  isTableHeaderLine,
  normalizeDeptKey,
  isCultureSampleTitle,
  isSectionDividerRow,
  isSectionDividerEstudio,
  skipSectionDividerBlock,
  isFlagToken,
  isCitoGroupTitle,
  CITO_GROUP_RE,
  isSkippedGroupTitle,
  isCommentNoiseEstudio,
  isLikelyGroupTitle,
  FLATTEN_DEPT_KEYS,
  isStudyRowHeader,
  isSerumQcAnalyte,
} from './labs-some-table-helpers.mjs';
import {
  parseBacteriologiaCultureGroup,
  readRowAt,
} from './labs-some-table-row.mjs';
import {
  normalizeSomeGroup,
  flattenDeptGroups,
  stripCommentNoiseFromDepartment,
} from './labs-some-table-normalize.mjs';`
);
parseBody = parseBody.replace(/parseCultureGroup/g, 'parseBacteriologiaCultureGroup').replace(/readSomeRowAt/g, 'readRowAt').replace(/stripDeptNoise/g, 'stripCommentNoiseFromDepartment');
fs.writeFileSync(path.join(ROOT, 'labs-some-table-parse.mjs'), parseBody);

write(
  'labs-some-table-export.mjs',
  `/** SOME table export models and TSV builders. */
import { buildTableTsv } from './tend-export.mjs';
import { formatSomeResultado } from './labs-some-table-helpers.mjs';
import { normalizeSomeGroup } from './labs-some-table-normalize.mjs';

${slice(747, 789)}

${slice(910, 948)}
`
);

write(
  'labs-some-table-render.mjs',
  `/** SOME table HTML rendering. */
import { formatSomeResultado } from './labs-some-table-helpers.mjs';
import { normalizeSomeGroup } from './labs-some-table-normalize.mjs';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

${slice(799, 908)}

${slice(950, 995)}
`
);

write(
  'labs-some-table-wire.mjs',
  `/** SOME table clipboard export wiring. */
import { copyTableModelAsPng, copyTableText } from './tend-export.mjs';
import {
  buildSomeGroupExportModel,
  buildSomeGroupTsv,
  buildSomeDeptExportModel,
  buildSomeDeptTsv,
} from './labs-some-table-export.mjs';

${slice(997, 1082)}
`
);

// formatSomeResultado is exported from helpers - add export keyword
helpers = fs.readFileSync(path.join(ROOT, 'labs-some-table-helpers.mjs'), 'utf8');
helpers = helpers.replace(
  /^\/\*\* Resultado con unidades integradas/,
  '/** Resultado con unidades integradas'
);
helpers = helpers.replace(/^function formatSomeResultado/m, 'export function formatSomeResultado');
helpers = helpers.replace(/\nexport \{\n[\s\S]*formatSomeResultado[\s\S]*\};\n$/, '\n');
fs.writeFileSync(path.join(ROOT, 'labs-some-table-helpers.mjs'), helpers);

write(
  'labs-some-table.mjs',
  `/**
 * Parser y exportación de tablas SOME por tipo de estudio (departamento + subgrupo).
 * Complementa procesarLabs: conserva filas tabulares del reporte original.
 */
export { SOME_DEPARTMENTS, formatSomeResultado } from './labs-some-table-helpers.mjs';
export { parseSomeReportTables } from './labs-some-table-parse.mjs';
export {
  buildSomeGroupExportModel,
  buildSomeGroupTsv,
  buildSomeDeptTsv,
  buildSomeDeptExportModel,
} from './labs-some-table-export.mjs';
export {
  renderSomeTableGroupHtml,
  renderSomeReportTablesHtml,
} from './labs-some-table-render.mjs';
export {
  exportSomeGroupCopy,
  exportSomeDeptCopy,
  wireSomeTableExportButtons,
} from './labs-some-table-wire.mjs';
`
);

console.log('labs-some-table split done');
