'use strict';

const SENSITIVE_BODY_KEYS = new Set(['pin', 'ticket', 'token', 'code', 'clientToken']);
const BEARER_RE = /^Bearer\s+\S+/i;

function redactBearerHeader(value) {
  const s = String(value || '');
  if (!BEARER_RE.test(s)) return s;
  return s.replace(BEARER_RE, 'Bearer [REDACTED]');
}

function redactAuthorizationHeaders(headers) {
  const out = { ...(headers || {}) };
  for (const k of Object.keys(out)) {
    if (k.toLowerCase() === 'authorization') out[k] = redactBearerHeader(out[k]);
  }
  return out;
}

function redactAuthBody(body) {
  if (!body || typeof body !== 'object') return body;
  const out = { ...body };
  for (const key of Object.keys(out)) {
    if (SENSITIVE_BODY_KEYS.has(key)) out[key] = '[REDACTED]';
  }
  return out;
}

function redactUrlSecrets(url) {
  return String(url || '').replace(
    /([?&](?:code|token)=)[^&]*/gi,
    '$1[REDACTED]'
  );
}

function redactForLog(value, depth = 0) {
  if (depth > 6) return '[MaxDepth]';
  if (value == null) return value;
  if (typeof value === 'string') return redactBearerHeader(redactUrlSecrets(value));
  if (Array.isArray(value)) {
    const redacted = value.map((v) => redactForLog(v, depth + 1));
    return depth === 0 ? JSON.stringify(redacted) : redacted;
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_BODY_KEYS.has(k) || k.toLowerCase() === 'authorization') {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactForLog(v, depth + 1);
      }
    }
    return depth === 0 ? JSON.stringify(out) : out;
  }
  return value;
}

module.exports = {
  redactBearerHeader,
  redactAuthorizationHeaders,
  redactAuthBody,
  redactUrlSecrets,
  redactForLog,
};
