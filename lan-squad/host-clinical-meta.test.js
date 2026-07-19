'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { readHostClinicalMeta, writeHostClinicalMeta } = require('./host-clinical-meta.js');

test('writeHostClinicalMeta round-trips rank and admin flag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-meta-'));
  writeHostClinicalMeta(dir, { rank: 'R4', isProgramAdmin: true });
  const meta = readHostClinicalMeta(dir);
  assert.equal(meta.rank, 'R4');
  assert.equal(meta.isProgramAdmin, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeHostClinicalMeta round-trips on-call guardia flag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-meta-oncall-'));
  writeHostClinicalMeta(dir, { rank: 'R1', isOnCallGuardia: true });
  const meta = readHostClinicalMeta(dir);
  assert.equal(meta.isOnCallGuardia, true);
  const updated = writeHostClinicalMeta(dir, { rank: 'R1', isOnCallGuardia: false });
  assert.equal(updated.isOnCallGuardia, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('startedAt is stamped once and stable across writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-meta-started-'));
  const first = writeHostClinicalMeta(dir, { rank: 'R4', isProgramAdmin: false });
  assert.ok(first.startedAt > 0);
  const second = writeHostClinicalMeta(dir, { rank: 'R3', isProgramAdmin: true });
  assert.equal(second.startedAt, first.startedAt);
  const read = readHostClinicalMeta(dir);
  assert.equal(read.startedAt, first.startedAt);
  fs.rmSync(dir, { recursive: true, force: true });
});
