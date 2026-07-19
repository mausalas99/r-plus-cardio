'use strict';

const UNSAFE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const SUPPORTED_ENTITIES = new Set(['historiaClinica', 'agenda', 'todo']);

const ALLOWLIST = {
  historiaClinica: [
    /^identificacion(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^motivoConsulta$/,
    /^apnp(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^app(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^ahf(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^genero$/,
    /^sexual(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^padecimientoActual$/,
    /^datosNegados(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^ipas(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^signosVitalesIngreso(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^labsAtAdmission(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^labAnchor$/,
    /^meta(?:\.[A-Za-z][A-Za-z0-9_-]*)?$/,
    /^labLookbackHours$/,
    /^plan$/,
  ],
  agenda: [/^title$/, /^date$/, /^time$/, /^patientId$/, /^notes$/, /^status$/, /^updatedAt$/],
  todo: [/^text$/, /^completed$/, /^priority$/, /^updatedAt$/, /^patientId$/],
};

function normalizeDeltaPath(path) {
  const normalized = String(path || '').trim();
  if (!normalized) throw new Error('empty_path');
  const segments = normalized.split('.');
  for (const segment of segments) {
    if (!segment) throw new Error('empty_path_segment');
    if (UNSAFE_SEGMENTS.has(segment)) throw new Error('unsafe_path');
    if (/^\d+$/.test(segment)) throw new Error('array_index_path');
  }
  return segments.join('.');
}

function pathAllowed(entityType, path) {
  const rules = ALLOWLIST[entityType] || [];
  return rules.some((rule) => rule.test(path));
}

function hasPathMeta(meta, rawPath, path) {
  return Object.prototype.hasOwnProperty.call(meta, rawPath) || Object.prototype.hasOwnProperty.call(meta, path);
}

function parseDeltaPayload(delta) {
  const values = delta && delta.pathValues && typeof delta.pathValues === 'object' ? delta.pathValues : null;
  const meta = delta && delta.pathMeta && typeof delta.pathMeta === 'object' ? delta.pathMeta : null;
  return { values, meta };
}

function classifyDeltaPath(type, rawPath, meta) {
  try {
    const path = normalizeDeltaPath(rawPath);
    if (!hasPathMeta(meta, rawPath, path)) return { outcome: 'reject', path, missingMeta: true };
    if (!pathAllowed(type, path)) return { outcome: 'reject', path, missingMeta: false };
    return { outcome: 'accept', path };
  } catch {
    return { outcome: 'reject', path: rawPath, missingMeta: false };
  }
}

function validateDeltaPaths(entityType, delta) {
  const type = String(entityType || '');
  if (!SUPPORTED_ENTITIES.has(type)) {
    return { ok: false, error: 'unsupported_entity', rejectedPaths: [] };
  }
  const { values, meta } = parseDeltaPayload(delta);
  if (!values || !meta) return { ok: false, error: 'invalid_delta', rejectedPaths: [] };

  const paths = [];
  const rejectedPaths = [];
  let missingMeta = false;

  for (const rawPath of Object.keys(values)) {
    const result = classifyDeltaPath(type, rawPath, meta);
    if (result.outcome === 'accept') {
      paths.push(result.path);
      continue;
    }
    if (result.missingMeta) missingMeta = true;
    rejectedPaths.push(result.path);
  }

  if (rejectedPaths.length) {
    return { ok: false, error: missingMeta ? 'missing_path_meta' : 'invalid_delta', paths, rejectedPaths };
  }
  return { ok: true, paths, rejectedPaths: [] };
}

function applyPathValue(target, path, value) {
  const segments = normalizeDeltaPath(path).split('.');
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  const leaf = segments[segments.length - 1];
  if (value === null) delete cursor[leaf];
  else cursor[leaf] = value;
  return target;
}

module.exports = {
  normalizeDeltaPath,
  validateDeltaPaths,
  applyPathValue,
  pathAllowed,
};
