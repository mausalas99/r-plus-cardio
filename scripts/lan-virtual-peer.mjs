#!/usr/bin/env node
/**
 * Simulates a second Mac pushing @usuario / clinicalOps to a live LAN host.
 * Use while R+ is running as host (port 3738).
 *
 * Examples:
 *   npm run dev:lan-virtual-peer -- --room sala-2
 *   npm run dev:lan-virtual-peer -- --host http://127.0.0.1:3738 --code "$(cat ~/Library/Application\ Support/R+/lan-team-code.txt)" --room sala-2
 *   npm run dev:lan-virtual-peer -- --probe
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const DEFAULT_PORT = 3738;

function parseArgs(argv) {
  const opts = {
    host: process.env.R_PLUS_LAN_HOST || `http://127.0.0.1:${DEFAULT_PORT}`,
    code: process.env.R_PLUS_LAN_TEAM_CODE || '',
    room: process.env.R_PLUS_LAN_ROOM || '',
    username: process.env.R_PLUS_LAN_PEER_USER || 'doctor_virtual',
    name: process.env.R_PLUS_LAN_PEER_NAME || 'Doctor Virtual',
    rank: process.env.R_PLUS_LAN_PEER_RANK || 'R2',
    sala: process.env.R_PLUS_LAN_PEER_SALA || 'Sala 2',
    probe: false,
    churn: false,
    delta: false,
    patientId: process.env.R_PLUS_LAN_PATIENT || 'pat_smoke_virtual',
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--probe') opts.probe = true;
    else if (a === '--churn') opts.churn = true;
    else if (a === '--delta') opts.delta = true;
    else if (a === '--patient') opts.patientId = String(argv[++i] || '').trim();
    else if (a === '--host') opts.host = String(argv[++i] || '').trim();
    else if (a === '--code') opts.code = String(argv[++i] || '').trim();
    else if (a === '--room') opts.room = String(argv[++i] || '').trim();
    else if (a === '--username') opts.username = String(argv[++i] || '').trim();
    else if (a === '--name') opts.name = String(argv[++i] || '').trim();
    else if (a === '--rank') opts.rank = String(argv[++i] || '').trim();
    else if (a === '--sala') opts.sala = String(argv[++i] || '').trim();
  }
  opts.host = opts.host.replace(/\/+$/, '');
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/lan-virtual-peer.mjs [options]

Simulates a second Mac publishing @usuario to the LAN host directorio.

Options:
  --probe              Ping host, list rooms, show roster (no push)
  --delta              POST field delta (historiaClinica labsAtAdmission.na) + verify replay
  --patient ID         Patient id for --delta (default: pat_smoke_virtual)
  --churn              After push, send sync-bundle with no clinicalOps (wipe regression)
  --host URL           Default: http://127.0.0.1:3738 or R_PLUS_LAN_HOST
  --code TOKEN         Bearer team code (R_PLUS_LAN_TEAM_CODE or host userData file)
  --room ID            LiveSync room id, e.g. sala-2
  --username HANDLE    Virtual @usuario (default: doctor_virtual)
  --name TEXT          Display name in guardia
  --rank R1..R4        Rank label
  --sala TEXT          Clinical sala label

Full second-app UX (Electron peer window):
  npm run dev:lan-peer-app
`);
}

function defaultHostUserDataCandidates() {
  if (process.platform === 'darwin') {
    const base = path.join(os.homedir(), 'Library', 'Application Support');
    return [path.join(base, 'r-plus'), path.join(base, 'R+')];
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return [path.join(appData, 'r-plus'), path.join(appData, 'R+')];
  }
  const base = path.join(os.homedir(), '.config');
  return [path.join(base, 'r-plus'), path.join(base, 'R+')];
}

function readTeamCodeFromUserData() {
  for (const dir of defaultHostUserDataCandidates()) {
    const file = path.join(dir, 'lan-team-code.txt');
    try {
      const line = fs.readFileSync(file, 'utf8').split('\n')[0].trim();
      if (line) return line;
    } catch {
      /* try next candidate */
    }
  }
  return '';
}

function authHeaders(code) {
  return { Authorization: `Bearer ${code}` };
}

async function lanFetch(base, code, pathname, init = {}) {
  const url = `${base}/api/lan/v1${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(code),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_e) {
    body = { raw: text };
  }
  return { res, body };
}

function rosterSummary(snapshot) {
  const users = snapshot && Array.isArray(snapshot.clinical_users) ? snapshot.clinical_users : [];
  return {
    count: users.length,
    handles: users.map((u) => u.username).filter(Boolean),
  };
}

function buildPeerSnapshot(opts) {
  const now = new Date().toISOString();
  return {
    exportedAt: now,
    clinical_users: [
      {
        user_id: randomUUID(),
        username: opts.username,
        rank: opts.rank,
        clinical_name: opts.name,
        sala: opts.sala,
        is_program_admin: 0,
      },
    ],
    teams: [],
    team_membership: [],
    clinical_users_deleted: [],
  };
}

async function runDeltaSmoke(opts) {
  const patientId = String(opts.patientId || 'pat_smoke_virtual').trim();
  const clientId = `virtual-peer-${opts.username}`;
  const txId = `tx_virtual_${Date.now().toString(36)}`;
  const sodiumValue = 141 + (Date.now() % 3);
  const clientTimestamp = Date.now();
  const roomPath = `/rooms/${encodeURIComponent(opts.room)}`;

  console.log(`Delta smoke: historiaClinica/${patientId} labsAtAdmission.na → ${sodiumValue}`);

  const post = await lanFetch(opts.host, opts.code, `${roomPath}/delta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType: 'historiaClinica',
      entityId: patientId,
      patientId,
      clientId,
      txId,
      pathValues: { 'labsAtAdmission.na': sodiumValue },
      pathMeta: { 'labsAtAdmission.na': { clientTimestamp } },
    }),
  });

  if (!post.res.ok) {
    throw new Error(`POST delta failed (${post.res.status}): ${JSON.stringify(post.body)}`);
  }
  if (post.body?.status !== 'ok' && post.body?.status !== 'partial_success') {
    throw new Error(`Delta not applied: ${JSON.stringify(post.body)}`);
  }

  const hc = await lanFetch(
    opts.host,
    opts.code,
    `/patients/${encodeURIComponent(patientId)}/historia-clinica?roomId=${encodeURIComponent(opts.room)}`
  );
  if (!hc.res.ok) {
    throw new Error(`GET historia-clinica failed (${hc.res.status}): ${JSON.stringify(hc.body)}`);
  }
  const na = hc.body?.data?.labsAtAdmission?.na;
  if (Number(na) !== sodiumValue) {
    throw new Error(`Host HC mismatch: expected na=${sodiumValue}, got ${JSON.stringify(na)}`);
  }

  const replay = await lanFetch(
    opts.host,
    opts.code,
    `${roomPath}/deltas?afterSeq=${Math.max(0, Number(post.body.deltaSeq || 1) - 1)}`
  );
  if (!replay.res.ok) {
    throw new Error(`GET deltas failed (${replay.res.status}): ${JSON.stringify(replay.body)}`);
  }
  const deltas = Array.isArray(replay.body?.deltas) ? replay.body.deltas : [];
  const matched = deltas.some((entry) => entry.txId === txId);
  if (!matched) {
    throw new Error(`Delta replay missing txId ${txId}`);
  }

  console.log(`Delta applied: seq=${post.body.deltaSeq} version=${post.body.version}`);
  console.log(`Host HC labsAtAdmission.na=${na}`);
  console.log(`Replay: ${deltas.length} delta(s) after seq ${Number(post.body.deltaSeq || 1) - 1}`);
  console.log('\nOn the host Mac: open expediente for this patient — sodium should match if synced.');

  return {
    ok: true,
    mode: 'delta',
    roomId: opts.room,
    patientId,
    deltaSeq: post.body.deltaSeq,
    sodiumValue,
    replayCount: deltas.length,
  };
}

export async function runLanVirtualPeer(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp();
    return { ok: true, mode: 'help' };
  }

  if (!opts.code) opts.code = readTeamCodeFromUserData();
  if (!opts.code) {
    throw new Error(
      'Missing team code. Pass --code, set R_PLUS_LAN_TEAM_CODE, or run R+ host once so lan-team-code.txt exists.'
    );
  }

  const ping = await lanFetch(opts.host, opts.code, '/ping');
  if (!ping.res.ok) {
    throw new Error(`Host ping failed (${ping.res.status}): ${JSON.stringify(ping.body)}`);
  }

  const roomsRes = await lanFetch(opts.host, opts.code, '/rooms');
  if (!roomsRes.res.ok) {
    throw new Error(`List rooms failed (${roomsRes.res.status})`);
  }
  const rooms = Array.isArray(roomsRes.body?.rooms) ? roomsRes.body.rooms : [];

  if (!opts.room && rooms.length === 1) {
    opts.room = String(rooms[0].id || '').trim();
  }
  if (!opts.room && rooms.length > 1) {
    const ids = rooms.map((r) => r.id).join(', ');
    throw new Error(`Multiple rooms (${ids}). Pass --room sala-N`);
  }
  if (!opts.room) {
    throw new Error('No LAN rooms on host. Create/join a sala in R+ first, or pass --room.');
  }

  const before = await lanFetch(opts.host, opts.code, `/rooms/${encodeURIComponent(opts.room)}/clinical-ops`);
  if (!before.res.ok) {
    throw new Error(`GET clinical-ops failed (${before.res.status}): ${JSON.stringify(before.body)}`);
  }

  const beforeRoster = rosterSummary(before.body?.snapshot);
  console.log(`Host: ${opts.host}`);
  console.log(`Room: ${opts.room}`);
  console.log(`Roster before: ${beforeRoster.count} user(s) → @${beforeRoster.handles.join(', @') || '—'}`);

  if (opts.probe) {
    return {
      ok: true,
      mode: 'probe',
      roomId: opts.room,
      usersBefore: beforeRoster.count,
      handlesBefore: beforeRoster.handles,
    };
  }

  if (opts.delta) {
    return runDeltaSmoke(opts);
  }

  const baseRevision = Number(before.body?.revision || 0);
  const snapshot = buildPeerSnapshot(opts);
  const put = await lanFetch(opts.host, opts.code, `/rooms/${encodeURIComponent(opts.room)}/clinical-ops`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseRevision,
      clientId: `virtual-peer-${opts.username}`,
      snapshot,
    }),
  });

  if (!put.res.ok) {
    throw new Error(`PUT clinical-ops failed (${put.res.status}): ${JSON.stringify(put.body)}`);
  }

  if (opts.churn) {
    const rev = Number(put.body?.revision || baseRevision + 1);
    const bundleRes = await lanFetch(opts.host, opts.code, `/rooms/${encodeURIComponent(opts.room)}/sync-bundle`);
    const entityVersions =
      bundleRes.body?.bundle?.entityVersions && typeof bundleRes.body.bundle.entityVersions === 'object'
        ? bundleRes.body.bundle.entityVersions
        : {};
    const churn = await lanFetch(opts.host, opts.code, `/rooms/${encodeURIComponent(opts.room)}/sync-bundle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseRevision: rev,
        baseEntityVersions: entityVersions,
        uploadedByClientId: `virtual-peer-${opts.username}`,
        agenda: [],
        todos: {},
      }),
    });
    if (!churn.res.ok) {
      throw new Error(`sync-bundle churn failed (${churn.res.status}): ${JSON.stringify(churn.body)}`);
    }
    console.log('Churn: sent sync-bundle without clinicalOps (roster wipe regression check)');
  }

  const after = await lanFetch(opts.host, opts.code, `/rooms/${encodeURIComponent(opts.room)}/clinical-ops`);
  const afterRoster = rosterSummary(after.body?.snapshot);
  console.log(`Pushed virtual peer @${opts.username}`);
  console.log(`Roster after:  ${afterRoster.count} user(s) → @${afterRoster.handles.join(', @') || '—'}`);

  if (afterRoster.count < beforeRoster.count + 1 && !afterRoster.handles.includes(opts.username)) {
    throw new Error('Virtual peer not visible in host roster after push');
  }

  console.log('\nOn the host Mac: open guardia / Mi rotación → directorio LAN — you should see @' + opts.username);
  return {
    ok: true,
    mode: opts.churn ? 'push+churn' : 'push',
    roomId: opts.room,
    usersBefore: beforeRoster.count,
    usersAfter: afterRoster.count,
    handlesAfter: afterRoster.handles,
  };
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  runLanVirtualPeer().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
