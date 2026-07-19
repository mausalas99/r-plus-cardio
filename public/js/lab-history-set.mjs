/**
 * Utilidades de conjuntos de laboratorio en historial: parseo, fusión por tipo, estudios en nota.
 */
export { isLabSectionHeaderLine, isCultivoBlockStartLine, splitResLabsByTipo } from './cultivo-block-core.mjs';
export { registerLabHistoryMaintRuntime } from './lab-history-maint.mjs';
export { bumpLabHistoryRevision } from './lab-history-cache.mjs';
export {
  isLikelyLabDataLine,
  extractLabDataLines,
  buildLabSetDateLine,
  buildLabSetDateLineForNota,
  formatLabHistoryListMeta,
  formatLabHistoryDateSelectLabel,
  labSetIsFromSome,
  dayKeyFromLabSet,
  primaryTipoForLabSet,
  groupLabHistoryByDay,
  buildEstudiosCopyLinesFromLabSets,
  resolveEstudiosCopyOptions,
} from './lab-history-format.mjs';
export {
  ensureParsedLabHistory,
  ensureParsedLabHistoryCached,
  runLabHistoryPostSaveMaintenance,
  scheduleLabHistoryPostSaveMaintenance,
  installLabHistoryAuditHook,
  rebuildEstudiosFromLabHistory,
} from './lab-history-maint.mjs';
