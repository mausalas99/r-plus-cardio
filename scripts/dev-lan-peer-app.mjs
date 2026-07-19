#!/usr/bin/env node
/**
 * Launch a second R+ window as a LAN *client* peer (separate userData, shared :3738 server).
 * Requires the primary R+ instance to already be running as host.
 *
 * Default: wipes peer userData so you get unconfigured sync onboarding every run.
 * Reuse prior peer state: npm run dev:lan-peer-app -- --keep
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const peerDir = path.join(os.tmpdir(), 'rplus-lan-peer');

function parseArgs(argv) {
  const opts = { fresh: true, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--fresh') opts.fresh = true;
    else if (arg === '--keep') opts.fresh = false;
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: npm run dev:lan-peer-app [-- --fresh|--keep]

Opens a second R+ window (virtual peer Mac) against the host on :3738.

Options:
  --fresh   Delete peer userData first (default) — sync mode + @usuario from scratch
  --keep    Reuse ${peerDir} (reconnect / resume peer session)
`);
}

function hostUserDataCandidates() {
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

function readHostTeamCode() {
  for (const dir of hostUserDataCandidates()) {
    try {
      const line = fs.readFileSync(path.join(dir, 'lan-team-code.txt'), 'utf8').split('\n')[0].trim();
      if (line.length >= 32) return line;
    } catch {
      /* try next */
    }
  }
  return '';
}

function resetPeerUserData() {
  if (fs.existsSync(peerDir)) {
    fs.rmSync(peerDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  }
  fs.mkdirSync(peerDir, { recursive: true });
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  printHelp();
  process.exit(0);
}

if (opts.fresh) resetPeerUserData();
else fs.mkdirSync(peerDir, { recursive: true });

const electronBin = path.join(repoRoot, 'node_modules', '.bin', 'electron');
const args = ['.', `--user-data-dir=${peerDir}`];

console.log('R+ LAN peer — second window (unconfigured sync)');
console.log('==============================================');
console.log(`Peer userData: ${peerDir}${opts.fresh ? ' (fresh)' : ' (kept)'}`);
console.log('');
console.log('Host (primary R+): ⇄ Wi‑Fi on, sala activa — copy invite “Otra Mac/sala”.');
console.log('');
const hostTeamCode = readHostTeamCode();
if (hostTeamCode) {
  console.log('LAN: peer will auto-target http://127.0.0.1:3738 with host team code.');
} else {
  console.log('LAN: no host team code found — paste ⇄ invite after onboarding, or run host R+ once.');
}
console.log('');
console.log('Peer (this window), in order:');
console.log('  1. Wait for onboarding (DB opens automatically — no password overlay)');
console.log('  2. “¿Cómo usarás R+?” → Guardia en red (LAN)  ← not “Solo este equipo”');
console.log('  3. Register @usuario + sala — leave PIN empty OR use host PIN del turno');
console.log('  4. Optional: ⇄ → Conectar al turno → paste host invite if auto-connect did not run');
console.log('  5. Delta smoke: same patient both sides — edit Sodio in HC');
console.log('');
console.log('Beacon ERR_ADDRESS_UNREACHABLE in DevTools = normal subnet scan noise.');
console.log('Reuse this peer without wiping: npm run dev:lan-peer-app -- --keep');
console.log('');

const child = spawn(electronBin, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    R_PLUS_LAN_PEER: '1',
    R_PLUS_LAN_DEV_PEER_HOST: 'http://127.0.0.1:3738',
    ...(hostTeamCode ? { R_PLUS_LAN_DEV_PEER_CODE: hostTeamCode } : {}),
  },
});

child.on('exit', (code) => process.exit(code == null ? 0 : code));
