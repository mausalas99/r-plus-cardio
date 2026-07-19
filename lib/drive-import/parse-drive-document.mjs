import { splitDocumentSections } from './segment.mjs';
import { parsePipeHeader, parseFichaIdentificacion, mergeHeader } from './parse-header.mjs';
import { mapUniversalHc, hasDriveHcSections } from './map-universal-hc.mjs';
import { mapSectionsToEventualidades } from './map-to-eventualidades.mjs';
import { inferDocumentYearFromText } from './eventualidad-dates.mjs';
import { filterNewEventualidades } from './merge-eventualidades.mjs';
import {
  parseDriveLaboratorios,
  extractLaboratoriosBody,
} from './parse-drive-labs.mjs';
import { filterNewDriveLabSets } from './merge-drive-labs.mjs';
import { formatDriveImportPreview } from './format-drive-import-preview.mjs';

/**
 * @param {string} rawText
 * @param {{
 *   existingEventualidades?: Array<{ at?: string, text?: string }>,
 *   existingLabHistory?: Array<{ fecha?: string, hora?: string, resLabs?: string[] }>,
 *   applyMode?: 'fill' | 'replace' | 'eventos',
 * }} [opts]
 */
function resolveEventualidadBlocks(split, rawText, hasHc) {
  let evBlocks = split.eventualidadesBlocks;
  if (evBlocks.length || hasHc) return evBlocks;
  const trimmed = String(rawText || '').trim();
  return trimmed ? [trimmed] : evBlocks;
}

function collectDriveDocumentWarnings(split, rawText, hasHc, evBlocks, evWarn, labParsed, labBody) {
  const warnings = split.warnings.slice();
  const trimmed = String(rawText || '').trim();
  if (!hasHc && !split.eventualidadesBlocks.length && evBlocks.length === 1 && evBlocks[0] === trimmed) {
    warnings.push('Texto interpretado como fragmento de eventualidades (sin encabezados de sección).');
  }
  if (!split.eventualidadesBlocks.length && !evBlocks.length) {
    warnings.push('No se encontró sección EVENTUALIDADES.');
  }
  warnings.push(...evWarn);
  warnings.push(...labParsed.warnings);
  if (labBody && !labParsed.sets.length) {
    warnings.push('Sección LABORATORIOS sin bloques de fecha reconocibles.');
  }
  return warnings;
}

export function parseDriveDocument(rawText, opts) {
  opts = opts || {};
  const split = splitDocumentSections(rawText);
  const pipe = parsePipeHeader(split.headerLines);
  const ficha = parseFichaIdentificacion(split.sections.ficha || '');
  const header = mergeHeader(pipe, ficha);
  const doc = { sections: split.sections, headerLines: split.headerLines };

  let hcPatch = mapUniversalHc(doc) || {};
  const sexo = hcPatch._sexo;
  if (sexo) delete hcPatch._sexo;
  if (sexo && !header.sexo) header.sexo = sexo;

  const hasHc = hasDriveHcSections(split.sections);
  const evBlocks = resolveEventualidadBlocks(split, rawText, hasHc);

  const documentYear = inferDocumentYearFromText(rawText);

  const { entries, warnings: evWarn } = mapSectionsToEventualidades({
    eventualidadesBlocks: evBlocks,
    referenceYear: documentYear,
    documentYear,
  });

  const { skipped: evSkipped } = filterNewEventualidades(opts.existingEventualidades || [], entries);

  const labBody = extractLaboratoriosBody(rawText, split.sections.laboratorios || '');
  const labParsed = parseDriveLaboratorios(labBody, { documentYear });
  const labFiltered = filterNewDriveLabSets(opts.existingLabHistory || [], labParsed.sets);

  const warnings = collectDriveDocumentWarnings(
    split,
    rawText,
    hasHc,
    evBlocks,
    evWarn,
    labParsed,
    labBody
  );

  const result = {
    header,
    driveSections: Object.assign({}, split.sections),
    hcPatch,
    eventualidades: {
      entries,
      skippedEstimate: evSkipped,
    },
    laboratorios: {
      sets: labFiltered.sets,
      allSets: labParsed.sets,
      skippedEstimate: labFiltered.skipped,
    },
    warnings,
  };

  result.previewText = formatDriveImportPreview(result, {
    applyMode: opts.applyMode,
    existingEventualidades: opts.existingEventualidades,
  });
  return result;
}
