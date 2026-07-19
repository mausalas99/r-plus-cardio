import {
  DEMO_BUNDLE_FORMAT,
  PATIENT_EXPORT_VERSION,
  entryToPatientExportPayload,
  isRPlusPatientExportPayload,
} from './patient-export-format.mjs';

const RANGE_EXPORT_FORMAT = 'r-plus-range-export';

function resolveDemoBundle(root) {
  if (
    root.format !== DEMO_BUNDLE_FORMAT ||
    Number(root.version) !== PATIENT_EXPORT_VERSION ||
    !Array.isArray(root.patients)
  ) {
    return [];
  }
  return root.patients.flatMap(function (item) {
    return resolvePatientImportPayloadsInner(item);
  });
}

function resolveRangeExport(root) {
  if (root.format !== RANGE_EXPORT_FORMAT || !Array.isArray(root.entries)) return [];
  const payloads = [];
  for (const entry of root.entries) {
    const normalized = entryToPatientExportPayload(/** @type {Record<string, unknown>} */ (entry));
    if (normalized) payloads.push(normalized);
  }
  return payloads;
}

/** @param {unknown} raw */
function resolvePatientImportPayloadsInner(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap(function (item) {
      return resolvePatientImportPayloadsInner(item);
    });
  }
  if (typeof raw !== 'object') return [];

  const root = /** @type {Record<string, unknown>} */ (raw);
  if (isRPlusPatientExportPayload(root)) return [root];

  if (!root.format && root.patient) {
    const normalized = entryToPatientExportPayload(root);
    return normalized ? [normalized] : [];
  }

  const demo = resolveDemoBundle(root);
  if (demo.length) return demo;

  return resolveRangeExport(root);
}

/** @param {unknown} raw */
export function resolvePatientImportPayloads(raw) {
  return resolvePatientImportPayloadsInner(raw);
}
