'use strict';
const assert = require('node:assert');
const { test } = require('node:test');
const {
  resolveHostPatientOwnerClientId,
  isHostPatientOwnedByOtherClient,
  shouldBlockHostPatientPurge,
} = require('./host-patient-ownership.js');

test('resolveHostPatientOwnerClientId — no audit log → empty', () => {
  assert.strictEqual(resolveHostPatientOwnerClientId({ id: 'p1' }), '');
  assert.strictEqual(resolveHostPatientOwnerClientId(null), '');
});

test('resolveHostPatientOwnerClientId — patient.create entry', () => {
  const row = {
    audit_log: [{ action: 'patient.create', clientId: 'client-A' }],
  };
  assert.strictEqual(resolveHostPatientOwnerClientId(row), 'client-A');
});

test('isHostPatientOwnedByOtherClient — owner host → not owned by other', () => {
  const row = { audit_log: [{ action: 'patient.create', clientId: 'host' }] };
  assert.strictEqual(isHostPatientOwnedByOtherClient(row, 'client-B'), false);
});

test('isHostPatientOwnedByOtherClient — same clientId → not owned by other', () => {
  const row = { audit_log: [{ action: 'patient.create', clientId: 'client-A' }] };
  assert.strictEqual(isHostPatientOwnedByOtherClient(row, 'client-A'), false);
});

test('isHostPatientOwnedByOtherClient — different clientId → owned by other', () => {
  const row = { audit_log: [{ action: 'patient.create', clientId: 'client-A' }] };
  assert.strictEqual(isHostPatientOwnedByOtherClient(row, 'client-B'), true);
});

test('isHostPatientOwnedByOtherClient — missing requester → not owned by other', () => {
  const row = { audit_log: [{ action: 'patient.create', clientId: 'client-A' }] };
  assert.strictEqual(isHostPatientOwnedByOtherClient(row, ''), false);
});

test('shouldBlockHostPatientPurge — admin bypasses', () => {
  const row = { audit_log: [{ action: 'patient.create', clientId: 'client-A' }] };
  assert.strictEqual(shouldBlockHostPatientPurge(row, 'client-B', true), false);
});

test('shouldBlockHostPatientPurge — missing clientId on owned row', () => {
  const row = { audit_log: [{ action: 'patient.create', clientId: 'client-A' }] };
  assert.strictEqual(shouldBlockHostPatientPurge(row, '', false), true);
});

test('shouldBlockHostPatientPurge — orphan row (no create owner)', () => {
  const row = { id: 'p-orphan', audit_log: [] };
  assert.strictEqual(shouldBlockHostPatientPurge(row, 'client-B', false), false);
});
