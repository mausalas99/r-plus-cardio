/** LAN sync diagnostics ring buffer and support report (IM-09). */

import {
  buildLanSyncDiagnosticsCore,
  resolveClinicalOpsTraceSource,
} from './lan-sync-diagnostics-build.mjs';

const MAX_ERRORS = 5;
const MAX_OPS_TRACE = 12;

/** @type {{ at: string, op: string, code: string, message: string }[]} */
const lastErrors = [];

/** @type {{ at: string, boundary: string, data: Record<string, unknown> }[]} */
const clinicalOpsTrace = [];

/**
 * @param {{ op?: string, code?: string, message?: string }} entry
 */
export function recordLanSyncError(entry) {
  const row = {
    at: new Date().toISOString(),
    op: String(entry && entry.op != null ? entry.op : 'unknown'),
    code: String(entry && entry.code != null ? entry.code : ''),
    message: String(entry && entry.message != null ? entry.message : ''),
  };
  lastErrors.unshift(row);
  if (lastErrors.length > MAX_ERRORS) lastErrors.length = MAX_ERRORS;
}

/**
 * Record a clinical-ops pipeline boundary (export, push, GET, merge, display).
 * @param {string} boundary
 * @param {Record<string, unknown>} [data]
 */
export function recordClinicalOpsTrace(boundary, data) {
  const row = {
    at: new Date().toISOString(),
    boundary: String(boundary || 'unknown'),
    data: data && typeof data === 'object' ? { ...data } : {},
  };
  clinicalOpsTrace.unshift(row);
  if (clinicalOpsTrace.length > MAX_OPS_TRACE) clinicalOpsTrace.length = MAX_OPS_TRACE;
}

/** @returns {{ at: string, boundary: string, data: Record<string, unknown> }[]} */
export function getClinicalOpsTrace() {
  return clinicalOpsTrace.map(function (e) {
    return { at: e.at, boundary: e.boundary, data: { ...e.data } };
  });
}

export function clearClinicalOpsTrace() {
  clinicalOpsTrace.length = 0;
}

/**
 * @param {Record<string, unknown>} [deps]
 */
export function getLanSyncDiagnostics(deps) {
  const d = deps && typeof deps === 'object' ? deps : {};
  const trace = resolveClinicalOpsTraceSource(d) || getClinicalOpsTrace();
  return {
    ...buildLanSyncDiagnosticsCore(d),
    clinicalOpsTrace: trace,
    lastErrors: lastErrors.map(function (e) {
      return { at: e.at, op: e.op, code: e.code, message: e.message };
    }),
  };
}

/**
 * Redact bearer tokens and team codes from a string.
 * @param {string} text
 */
export function redactLanSecrets(text) {
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._+/=-]+/gi, 'Bearer ***')
    .replace(/"teamCode"\s*:\s*"[^"]*"/gi, '"teamCode":"***"')
    .replace(/teamCode[=:]\s*[A-Za-z0-9._+/=-]+/gi, 'teamCode=***')
    .replace(/"code"\s*:\s*"[A-Za-z0-9._+/=-]{8,}"/gi, '"code":"***"');
}

/**
 * @param {ReturnType<typeof getLanSyncDiagnostics>} diag
 */
export function formatDiagnosticsReport(diag) {
  const payload = diag && typeof diag === 'object' ? diag : getLanSyncDiagnostics();
  return redactLanSecrets(JSON.stringify(payload, null, 2));
}

/**
 * @param {Record<string, unknown>} [input]
 */
export function buildCommandSyncDiagnostics(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    commandQueueDepth: Number(src.commandQueueDepth || 0),
    oldestPendingCommandAgeMs: Number(src.oldestPendingCommandAgeMs || 0),
    lastCommandAck: src.lastCommandAck || null,
    lastAppliedSeq: Number(src.lastAppliedSeq || 0),
    lastAckedCommandId: String(src.lastAckedCommandId || ''),
    schedulerPendingRooms: Array.isArray(src.schedulerPendingRooms) ? src.schedulerPendingRooms.slice() : [],
    lastFlush: src.lastFlush || null,
    staleBaseCount: Number(src.staleBaseCount || 0),
    duplicateCommandCount: Number(src.duplicateCommandCount || 0),
    clockDriftWarnings: Number(src.clockDriftWarnings || 0),
    replayGapCount: Number(src.replayGapCount || 0),
    fullBundleFallbackCount: Number(src.fullBundleFallbackCount || 0),
  };
}
