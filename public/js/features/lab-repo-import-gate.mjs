import { buildBulkLabPreview } from '../lab-bulk-paste.mjs';

export function buildLabRepoBulkText(studies) {
  return (studies || [])
    .map(function (s) {
      return String(s.text || '').trim();
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * @param {{
 *   blocks: import('../lab-bulk-paste.mjs').BulkBlockPreview[],
 *   fetchErrors: { folio: string, message: string }[],
 *   requestedRegistro: string,
 *   activePatientRegistro: string,
 *   activePatientId: string | null,
 * }} ctx
 */
export function shouldSilentImportLabRepo(ctx) {
  if (ctx.fetchErrors && ctx.fetchErrors.length) {
    return { silent: false, reason: 'fetch-errors' };
  }
  if (!ctx.blocks.length) {
    return { silent: false, reason: 'no-blocks' };
  }
  var bad = ctx.blocks.filter(function (b) {
    return b.status !== 'ok' || !b.canProcess || !b.okReportCount;
  });
  if (bad.length) {
    return { silent: false, reason: 'block-issues' };
  }
  if (
    ctx.activePatientId &&
    ctx.activePatientRegistro &&
    ctx.requestedRegistro &&
    ctx.activePatientRegistro.trim() !== ctx.requestedRegistro.trim()
  ) {
    return { silent: false, reason: 'registro-mismatch' };
  }
  return { silent: true, reason: 'ok' };
}

export function buildLabRepoPreviewBlocks(studies, findPatientByRegistro) {
  var text = buildLabRepoBulkText(studies);
  return buildBulkLabPreview(text, { findPatientByRegistro: findPatientByRegistro });
}

function isLabRepoConnectionError(message) {
  return /lab-repo-http-|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(
    String(message || '')
  );
}

/**
 * User-facing outcome for fetch (studies empty). Returns null when import should proceed.
 * @param {{ folio?: string, message?: string, totalRows?: number }[]} errors
 */
export function resolveLabRepoFetchUserMessage(studies, errors) {
  if (studies && studies.length) return null;
  var list = errors || [];
  if (!list.length) {
    return {
      toast: 'Sin estudios en el rango seleccionado',
      type: 'info',
    };
  }

  var first = list[0] || {};
  var code = String(first.message || '');

  if (isLabRepoConnectionError(code)) {
    return {
      toast: 'No se pudo conectar al repositorio de laboratorio (revisa red hospital)',
      type: 'error',
    };
  }

  if (code === 'no-search-results') {
    return {
      toast: 'No hay estudios para ese registro en el portal',
      type: 'info',
    };
  }

  if (code === 'no-rows-in-range') {
    var total = first.totalRows;
    if (typeof total === 'number' && total > 0) {
      return {
        toast:
          'Hay ' +
          total +
          ' estudio' +
          (total === 1 ? '' : 's') +
          ' para ese registro pero ninguno en el rango de fechas. Amplía Desde/Hasta.',
        type: 'info',
      };
    }
    return {
      toast: 'Sin estudios en el rango seleccionado',
      type: 'info',
    };
  }

  if (list.every(function (e) {
    return e.folio;
  })) {
    return {
      toast: 'No se pudieron descargar los reportes (' + list.length + ' fallos)',
      type: 'error',
    };
  }

  return {
    toast: 'Error al consultar el repositorio: ' + code,
    type: 'error',
  };
}
