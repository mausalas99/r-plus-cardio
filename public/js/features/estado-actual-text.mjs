import {
  resolveSoporteClause,
  buildHiTempClause,
  resolveKcalDisplay,
  buildNmClause,
  assembleSoapLines,
} from './estado-actual-text-build.mjs';
import { normalizeEaTextInputs } from './estado-actual-text-inputs.mjs';
import { patientHasInsulinRescatesInReceta } from './estado-actual-glu-rescue.mjs';
import { detectInsulinPumpAlgorithmFromRecetaBlock } from '../insulin-pump-some-detect.mjs';

/**
 * Pure SOAP Estado Actual texto (sin Subjetivo): snapshot SV/glu/io + estado clínico + balance de turno.
 * @param {Record<string, unknown> | null | undefined} estadoClinico
 * @param {{ vitals?: Record<string, unknown>, glucometrias?: Array<{ value?: unknown }>, bombaInsulina?: Array<{ value?: unknown, units?: unknown }>, io?: { ing?: unknown, egr?: unknown, egrParts?: unknown[], evac?: unknown }, alteredAt?: Record<string, string> } | null | undefined} snapshot
 * @param {{ balanceTurno?: unknown } | null | undefined} balances
 * @param {{ patientPeso?: unknown, recetaBlock?: { items?: unknown[] } | null, rescatesInSome?: boolean, bombaAlgoritmo?: number | null } | null | undefined} [options]
 * @returns {string}
 */
export function buildEstadoActualText(estadoClinico, snapshot, balances, options) {
  options = options || {};
  var ctx = normalizeEaTextInputs(estadoClinico, snapshot, balances);
  var soporte = resolveSoporteClause(ctx.ec);
  var hiTemp = buildHiTempClause(ctx.v, ctx.snapAlt, ctx.tempPeakAt, options.now);
  var kcalDisplay = resolveKcalDisplay(ctx.ec, options);
  var rescatesInSome =
    options.rescatesInSome != null
      ? !!options.rescatesInSome
      : patientHasInsulinRescatesInReceta(options.recetaBlock || null);
  var bombaAlgoritmo =
    options.bombaAlgoritmo != null
      ? options.bombaAlgoritmo
      : snapshot &&
          typeof snapshot === 'object' &&
          /** @type {any} */ (snapshot).bombaInsulinaAlgoritmo != null
        ? /** @type {any} */ (snapshot).bombaInsulinaAlgoritmo
        : detectInsulinPumpAlgorithmFromRecetaBlock(options.recetaBlock || null);
  var nmClause = buildNmClause(ctx.ec, kcalDisplay, ctx.snapIo, ctx.btTurno, ctx.glSrc, ctx.bombaSrc, {
    rescatesInSome: rescatesInSome,
    bombaAlgoritmo: bombaAlgoritmo,
  });
  return assembleSoapLines(ctx.ec, ctx.v, soporte, hiTemp, nmClause).join('\n');
}
