'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { hashTeamCode } = require('./team-code.js');
const { readHostState, writeHostState } = createRequire(__filename)(
  '../lib/db/lan-host-persistence.mjs'
);

const WEAK_EXACT = new Set(['1234']);
const LEGACY_RANDOM_TEAM_CODE_RE = /^[a-f0-9]{32}$/i;
const MIN_TOKEN_LEN = 32;

function generateSecureLanToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isWeakLanToken(token) {
  const t = String(token || '').trim();
  if (!t || t.length < MIN_TOKEN_LEN) return true;
  if (WEAK_EXACT.has(t)) return true;
  if (LEGACY_RANDOM_TEAM_CODE_RE.test(t)) return true;
  return false;
}

function atomicWriteTeamCode(filePath, token) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, token + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

function lanGuestBearerPath(userDataPath) {
  return path.join(String(userDataPath || ''), 'lan-guest-bearer.txt');
}

function lanTeamCodePath(userDataPath) {
  return path.join(String(userDataPath || ''), 'lan-team-code.txt');
}

/** Guest-only bearer (remote host token); never overwrites lan-team-code.txt. */
function readLanGuestBearerFile({ userDataPath }) {
  const filePath = lanGuestBearerPath(userDataPath);
  try {
    if (!fs.existsSync(filePath)) return { ok: false, error: 'no_guest_file' };
    const code = fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0].trim();
    if (!code || isWeakLanToken(code)) return { ok: false, error: 'weak_or_missing_token' };
    return { ok: true, code, source: 'guest_file' };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'read_failed' };
  }
}

function writeLanGuestBearerFile({ userDataPath, token }) {
  const code = String(token || '').trim();
  if (!code || isWeakLanToken(code)) return { ok: false, error: 'invalid_token' };
  atomicWriteTeamCode(lanGuestBearerPath(userDataPath), code);
  return { ok: true };
}

/**
 * 7.2.0 wrote guest bearer into lan-team-code.txt — regenerate local host token when detected.
 * @returns {{ recovered: boolean, token?: string }}
 */
function recoverLocalHostTeamCodeIfGuestOverwrite({ userDataPath, hostStatePath, db } = {}) {
  const hostPath = lanTeamCodePath(userDataPath);
  const guestPath = lanGuestBearerPath(userDataPath);
  if (!fs.existsSync(hostPath) || !fs.existsSync(guestPath)) return { recovered: false };
  const host = fs.readFileSync(hostPath, 'utf8').split(/\r?\n/, 1)[0].trim();
  const guest = fs.readFileSync(guestPath, 'utf8').split(/\r?\n/, 1)[0].trim();
  if (!host || !guest || host !== guest) return { recovered: false };
  const token = generateSecureLanToken();
  atomicWriteTeamCode(hostPath, token);
  reconcileLanHostStateTeamCodeFile(hostStatePath, token);
  reconcileLanHostStateTeamCodeDb(db, token);
  return { recovered: true, token };
}

function rehashLanHostState(hostStatePath, plainToken) {
  if (!hostStatePath || !fs.existsSync(hostStatePath)) return { updated: false };
  const raw = fs.readFileSync(hostStatePath, 'utf8');
  const state = JSON.parse(raw);
  state.teamCodeHash = hashTeamCode(plainToken);
  const dir = path.dirname(hostStatePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${hostStatePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
  fs.renameSync(tmp, hostStatePath);
  return { updated: true };
}

function reconcileLanHostStateTeamCodeFile(hostStatePath, plainToken) {
  if (!hostStatePath || !fs.existsSync(hostStatePath)) return { updated: false };
  const expected = hashTeamCode(plainToken);
  let state;
  try {
    state = JSON.parse(fs.readFileSync(hostStatePath, 'utf8'));
  } catch {
    return { updated: false };
  }
  if (!state || state.teamCodeHash === expected) return { updated: false };
  return rehashLanHostState(hostStatePath, plainToken);
}

function reconcileLanHostStateTeamCodeDb(db, plainToken) {
  if (!db) return { updated: false };
  let state;
  try {
    state = readHostState(db);
  } catch {
    return { updated: false };
  }
  if (!state) return { updated: false };
  const expected = hashTeamCode(plainToken);
  if (state.teamCodeHash === expected) return { updated: false };
  state.teamCodeHash = expected;
  writeHostState(db, state);
  return { updated: true };
}

function reconcileLanHostTeamCode({ hostStatePath, plainToken, db } = {}) {
  const token = String(plainToken || '').trim();
  if (!token) return { file: { updated: false }, db: { updated: false } };
  return {
    file: reconcileLanHostStateTeamCodeFile(hostStatePath, token),
    db: reconcileLanHostStateTeamCodeDb(db, token),
  };
}

function bootstrapLanTeamCode({ userDataPath, hostStatePath, db } = {}) {
  recoverLocalHostTeamCodeIfGuestOverwrite({ userDataPath, hostStatePath, db });
  const filePath = lanTeamCodePath(userDataPath);
  let token = '';
  let source = 'file';
  let requiresMigrationNotice = false;
  let rotated = false;

  if (process.env.R_PLUS_LAN_TEAM_CODE) {
    token = String(process.env.R_PLUS_LAN_TEAM_CODE).trim();
    if (isWeakLanToken(token)) {
      const err = new Error(
        'R_PLUS_LAN_TEAM_CODE is too weak (min 32 chars, not 1234/legacy 32-hex). Refusing to start.'
      );
      err.code = 'LAN_WEAK_ENV_TOKEN';
      throw err;
    }
    source = 'env';
  } else if (fs.existsSync(filePath)) {
    token = fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0].trim();
    if (isWeakLanToken(token)) {
      token = generateSecureLanToken();
      atomicWriteTeamCode(filePath, token);
      requiresMigrationNotice = true;
      rotated = true;
    }
  } else {
    token = generateSecureLanToken();
    atomicWriteTeamCode(filePath, token);
    source = 'created';
  }

  if (!token) {
    const err = new Error('Could not establish secure LAN team token');
    err.code = 'LAN_NO_TOKEN';
    throw err;
  }

  reconcileLanHostStateTeamCodeFile(hostStatePath, token);

  return { token, source, requiresMigrationNotice, rotated };
}

/** Read token from disk only (IPC); never returns weak or default fallbacks. */
function readLanTeamCodeFile({ userDataPath }) {
  const filePath = path.join(String(userDataPath || ''), 'lan-team-code.txt');
  try {
    if (!fs.existsSync(filePath)) return { ok: false, error: 'no_token_file' };
    const code = fs.readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0].trim();
    if (!code || isWeakLanToken(code)) return { ok: false, error: 'weak_or_missing_token' };
    return { ok: true, code, source: 'file' };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : 'read_failed' };
  }
}

module.exports = {
  bootstrapLanTeamCode,
  rehashLanHostState,
  reconcileLanHostStateTeamCodeFile,
  reconcileLanHostStateTeamCodeDb,
  reconcileLanHostTeamCode,
  isWeakLanToken,
  generateSecureLanToken,
  readLanTeamCodeFile,
  readLanGuestBearerFile,
  writeLanGuestBearerFile,
  recoverLocalHostTeamCodeIfGuestOverwrite,
  lanGuestBearerPath,
  lanTeamCodePath,
  LEGACY_RANDOM_TEAM_CODE_RE,
};
