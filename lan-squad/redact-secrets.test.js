'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
  redactBearerHeader,
  redactAuthBody,
  redactUrlSecrets,
  redactForLog,
} = require('./redact-secrets.js');

test('redactBearerHeader masks token', () => {
  const h = 'Bearer abcdef0123456789';
  assert.strictEqual(redactBearerHeader(h), 'Bearer [REDACTED]');
});

test('redactAuthBody masks pin and ticket', () => {
  const out = redactAuthBody({ pin: '482917', ticket: 'req_abc', ok: true });
  assert.strictEqual(out.pin, '[REDACTED]');
  assert.strictEqual(out.ticket, '[REDACTED]');
  assert.strictEqual(out.ok, true);
});

test('redactAuthBody masks clientToken', () => {
  const out = redactAuthBody({ clientToken: 'cit_abc123', clientId: 'lc_test' });
  assert.strictEqual(out.clientToken, '[REDACTED]');
  assert.strictEqual(out.clientId, 'lc_test');
});

test('redactUrlSecrets masks code and token query params', () => {
  const u = redactUrlSecrets('/api/lan/v1/ws?code=secret&channel=sync');
  assert.ok(!u.includes('secret'));
  assert.ok(u.includes('code=[REDACTED]') || u.includes('code=%5BREDACTED%5D'));
});

test('redactForLog redacts nested authorization', () => {
  const s = redactForLog({ headers: { authorization: 'Bearer xyz' } });
  assert.ok(!s.includes('xyz'));
});
