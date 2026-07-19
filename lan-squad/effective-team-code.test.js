'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const { hashTeamCode } = require('./team-code.js');
const {
  bootstrapLanTeamCode,
  rehashLanHostState,
  reconcileLanHostStateTeamCodeFile,
  reconcileLanHostTeamCode,
  isWeakLanToken,
  generateSecureLanToken,
  readLanGuestBearerFile,
  writeLanGuestBearerFile,
  recoverLocalHostTeamCodeIfGuestOverwrite,
} = require('./effective-team-code.js');

test('isWeakLanToken flags 1234 and 32-hex legacy', () => {
  assert.strictEqual(isWeakLanToken('1234'), true);
  assert.strictEqual(isWeakLanToken('a'.repeat(32)), true);
  assert.strictEqual(isWeakLanToken('x'.repeat(64)), false);
  assert.strictEqual(isWeakLanToken(''), true);
  assert.strictEqual(isWeakLanToken('short'), true);
});

test('generateSecureLanToken returns 64 hex chars', () => {
  const token = generateSecureLanToken();
  assert.strictEqual(token.length, 64);
  assert.ok(/^[a-f0-9]{64}$/i.test(token));
  assert.strictEqual(isWeakLanToken(token), false);
});

test('bootstrapLanTeamCode rotates 1234 and rehashes host state without data loss', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-bootstrap-'));
  const hostPath = path.join(dir, 'lan-squad-host-state.json');
  const plainWeak = '1234';
  fs.writeFileSync(path.join(dir, 'lan-team-code.txt'), plainWeak + '\n', 'utf8');
  fs.writeFileSync(
    hostPath,
    JSON.stringify({
      version: 1,
      teamCodeHash: hashTeamCode(plainWeak),
      patients: [{ id: 'p1', nombre: 'Ana', version: 1 }],
      rooms: [{ id: 'r1', displayName: 'UCI' }],
      roomSyncBundles: {},
    }),
    'utf8'
  );
  delete process.env.R_PLUS_LAN_TEAM_CODE;
  const boot = bootstrapLanTeamCode({ userDataPath: dir, hostStatePath: hostPath });
  assert.strictEqual(boot.requiresMigrationNotice, true);
  assert.strictEqual(boot.token.length, 64);
  assert.notStrictEqual(boot.token, '1234');
  const st = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
  assert.strictEqual(st.patients.length, 1);
  assert.strictEqual(st.patients[0].nombre, 'Ana');
  assert.strictEqual(st.rooms.length, 1);
  assert.strictEqual(st.rooms[0].displayName, 'UCI');
  assert.deepStrictEqual(st.roomSyncBundles, {});
  assert.strictEqual(st.teamCodeHash, hashTeamCode(boot.token));
  const fileToken = fs.readFileSync(path.join(dir, 'lan-team-code.txt'), 'utf8').trim();
  assert.strictEqual(fileToken, boot.token);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bootstrapLanTeamCode rotates legacy 32-hex and rehashes host state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-bootstrap-legacy-'));
  const hostPath = path.join(dir, 'lan-squad-host-state.json');
  const plainWeak = 'a'.repeat(32);
  fs.writeFileSync(path.join(dir, 'lan-team-code.txt'), plainWeak + '\n', 'utf8');
  fs.writeFileSync(
    hostPath,
    JSON.stringify({
      version: 1,
      teamCodeHash: hashTeamCode(plainWeak),
      patients: [{ id: 'p2', nombre: 'Luis', version: 1 }],
      rooms: [],
      roomSyncBundles: { r1: { v: 1 } },
    }),
    'utf8'
  );
  delete process.env.R_PLUS_LAN_TEAM_CODE;
  const boot = bootstrapLanTeamCode({ userDataPath: dir, hostStatePath: hostPath });
  assert.strictEqual(boot.requiresMigrationNotice, true);
  assert.strictEqual(boot.token.length, 64);
  const st = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
  assert.strictEqual(st.patients.length, 1);
  assert.deepStrictEqual(st.roomSyncBundles, { r1: { v: 1 } });
  assert.strictEqual(st.teamCodeHash, hashTeamCode(boot.token));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bootstrapLanTeamCode creates secure token on fresh install', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-bootstrap-new-'));
  const hostPath = path.join(dir, 'lan-squad-host-state.json');
  delete process.env.R_PLUS_LAN_TEAM_CODE;
  const boot = bootstrapLanTeamCode({ userDataPath: dir, hostStatePath: hostPath });
  assert.strictEqual(boot.source, 'created');
  assert.strictEqual(boot.requiresMigrationNotice, false);
  assert.strictEqual(boot.token.length, 64);
  assert.strictEqual(isWeakLanToken(boot.token), false);
  assert.ok(fs.existsSync(path.join(dir, 'lan-team-code.txt')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bootstrapLanTeamCode keeps strong existing file token', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-bootstrap-strong-'));
  const strong = 'x'.repeat(64);
  fs.writeFileSync(path.join(dir, 'lan-team-code.txt'), strong + '\n', 'utf8');
  delete process.env.R_PLUS_LAN_TEAM_CODE;
  const boot = bootstrapLanTeamCode({ userDataPath: dir, hostStatePath: path.join(dir, 'host.json') });
  assert.strictEqual(boot.source, 'file');
  assert.strictEqual(boot.token, strong);
  assert.strictEqual(boot.requiresMigrationNotice, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bootstrapLanTeamCode rejects weak env token', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-bootstrap-env-'));
  const prev = process.env.R_PLUS_LAN_TEAM_CODE;
  process.env.R_PLUS_LAN_TEAM_CODE = '1234';
  try {
    assert.throws(
      () => bootstrapLanTeamCode({ userDataPath: dir, hostStatePath: path.join(dir, 'host.json') }),
      (e) => e.code === 'LAN_WEAK_ENV_TOKEN'
    );
  } finally {
    if (prev !== undefined) process.env.R_PLUS_LAN_TEAM_CODE = prev;
    else delete process.env.R_PLUS_LAN_TEAM_CODE;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rehashLanHostState updates hash and preserves clinical data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-rehash-'));
  const hostPath = path.join(dir, 'lan-squad-host-state.json');
  const oldToken = '1234';
  const newToken = generateSecureLanToken();
  fs.writeFileSync(
    hostPath,
    JSON.stringify({
      version: 1,
      teamCodeHash: hashTeamCode(oldToken),
      patients: [{ id: 'p1', nombre: 'Ana', version: 1 }],
      rooms: [{ id: 'r1', displayName: 'UCI' }],
      roomSyncBundles: { r1: { sync: true } },
    }),
    'utf8'
  );
  const out = rehashLanHostState(hostPath, newToken);
  assert.strictEqual(out.updated, true);
  const st = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
  assert.strictEqual(st.teamCodeHash, hashTeamCode(newToken));
  assert.strictEqual(st.patients.length, 1);
  assert.strictEqual(st.rooms.length, 1);
  assert.deepStrictEqual(st.roomSyncBundles, { r1: { sync: true } });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('rehashLanHostState returns updated false when file missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-rehash-miss-'));
  const out = rehashLanHostState(path.join(dir, 'missing.json'), generateSecureLanToken());
  assert.strictEqual(out.updated, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bootstrapLanTeamCode reconciles stale host-state hash for strong existing token', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-bootstrap-reconcile-'));
  const hostPath = path.join(dir, 'lan-squad-host-state.json');
  const strong = 'x'.repeat(64);
  fs.writeFileSync(path.join(dir, 'lan-team-code.txt'), strong + '\n', 'utf8');
  fs.writeFileSync(
    hostPath,
    JSON.stringify({
      version: 2,
      teamCodeHash: hashTeamCode('stale-token-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
      patients: [{ id: 'p1', nombre: 'Ana', version: 1 }],
      rooms: [],
      roomSyncBundles: {},
    }),
    'utf8'
  );
  delete process.env.R_PLUS_LAN_TEAM_CODE;
  const boot = bootstrapLanTeamCode({ userDataPath: dir, hostStatePath: hostPath });
  assert.strictEqual(boot.token, strong);
  const st = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
  assert.strictEqual(st.teamCodeHash, hashTeamCode(strong));
  assert.strictEqual(st.patients.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('reconcileLanHostStateTeamCodeFile is no-op when hash already matches', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-reconcile-noop-'));
  const hostPath = path.join(dir, 'host.json');
  const token = generateSecureLanToken();
  fs.writeFileSync(
    hostPath,
    JSON.stringify({
      version: 2,
      teamCodeHash: hashTeamCode(token),
      patients: [],
      rooms: [],
      roomSyncBundles: {},
    }),
    'utf8'
  );
  const out = reconcileLanHostStateTeamCodeFile(hostPath, token);
  assert.strictEqual(out.updated, false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('reconcileLanHostTeamCode updates file and db without data loss', async () => {
  const { createUnlockedDbManager } = await import('../lib/db/test-open-db.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-reconcile-db-'));
  const hostPath = path.join(dir, 'lan-squad-host-state.json');
  const oldToken = 'old-token-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  const newToken = generateSecureLanToken();
  fs.writeFileSync(
    hostPath,
    JSON.stringify({
      version: 2,
      teamCodeHash: hashTeamCode(oldToken),
      patients: [{ id: 'p1', nombre: 'Ana', version: 1 }],
      rooms: [{ id: 'r1', displayName: 'UCI' }],
      roomSyncBundles: {},
    }),
    'utf8'
  );
  const mgr = await createUnlockedDbManager(dir, () => 'reconcile-db-test');
  const { writeHostState } = await import('../lib/db/lan-host-persistence.mjs');
  writeHostState(mgr.getDb(), {
    version: 2,
    teamCodeHash: hashTeamCode(oldToken),
    patients: [{ id: 'p1', nombre: 'Ana', version: 1 }],
    rooms: [{ id: 'r1', displayName: 'UCI' }],
    roomSyncBundles: {},
  });
  try {
    const out = reconcileLanHostTeamCode({
      hostStatePath: hostPath,
      plainToken: newToken,
      db: mgr.getDb(),
    });
    assert.strictEqual(out.file.updated, true);
    assert.strictEqual(out.db.updated, true);
    const fileState = JSON.parse(fs.readFileSync(hostPath, 'utf8'));
    assert.strictEqual(fileState.teamCodeHash, hashTeamCode(newToken));
    assert.strictEqual(fileState.patients.length, 1);
    const { readHostState } = await import('../lib/db/lan-host-persistence.mjs');
    const dbState = readHostState(mgr.getDb());
    assert.strictEqual(dbState.teamCodeHash, hashTeamCode(newToken));
    assert.strictEqual(dbState.patients.length, 1);
  } finally {
    mgr.lock();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('guest bearer uses separate file and does not overwrite host team code', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-guest-'));
  const hostPath = path.join(dir, 'lan-team-code.txt');
  const guestPath = path.join(dir, 'lan-guest-bearer.txt');
  const localToken = 'a'.repeat(64);
  fs.writeFileSync(hostPath, localToken + '\n', 'utf8');
  const guestToken = 'b'.repeat(64);
  const written = writeLanGuestBearerFile({ userDataPath: dir, token: guestToken });
  assert.strictEqual(written.ok, true);
  assert.strictEqual(fs.readFileSync(guestPath, 'utf8').trim(), guestToken);
  assert.strictEqual(fs.readFileSync(hostPath, 'utf8').trim(), localToken);
  const read = readLanGuestBearerFile({ userDataPath: dir });
  assert.strictEqual(read.ok, true);
  assert.strictEqual(read.code, guestToken);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('recoverLocalHostTeamCodeIfGuestOverwrite regenerates host token when files match', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-guest-recover-'));
  const token = 'c'.repeat(64);
  fs.writeFileSync(path.join(dir, 'lan-team-code.txt'), token + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'lan-guest-bearer.txt'), token + '\n', 'utf8');
  const out = recoverLocalHostTeamCodeIfGuestOverwrite({ userDataPath: dir });
  assert.strictEqual(out.recovered, true);
  assert.ok(out.token && out.token.length >= 32);
  assert.notStrictEqual(fs.readFileSync(path.join(dir, 'lan-team-code.txt'), 'utf8').trim(), token);
  fs.rmSync(dir, { recursive: true, force: true });
});
