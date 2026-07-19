#!/usr/bin/env node
/**
 * One-time Cloudflare setup for R+ equipos worker.
 * Run from repo root: node cloudflare/setup.mjs
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, '../cloud/equipos-worker');
const WRANGLER_TOML = path.join(WORKER_DIR, 'wrangler.toml');
const D1_NAME = 'rplus-equipos';
const R2_BUCKET = 'rplus-equipos-photos';

function log(msg) {
  console.log(`\n▸ ${msg}`);
}

function run(cmd, opts = {}) {
  const cwd = opts.cwd || WORKER_DIR;
  console.log(`  $ ${cmd}`);
  return execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
  });
}

function runCapture(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: opts.cwd || WORKER_DIR,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function readToml() {
  return fs.readFileSync(WRANGLER_TOML, 'utf8');
}

function writeToml(content) {
  fs.writeFileSync(WRANGLER_TOML, content);
}

function getDatabaseId(toml) {
  const m = /database_id\s*=\s*"([^"]+)"/.exec(toml);
  return m ? m[1] : '';
}

function setDatabaseId(toml, id) {
  return toml.replace(
    /database_id\s*=\s*"[^"]*"/,
    `database_id = "${id}"`
  );
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function ensureLoggedIn() {
  log('Checking Cloudflare login…');
  try {
    const out = runCapture('npx wrangler whoami', { cwd: WORKER_DIR });
    if (/You are not authenticated|Not logged in/i.test(out)) throw new Error('not logged in');
    console.log(out);
    return;
  } catch {
    console.error(
      '\n✘ Not logged in to Cloudflare.\n\n' +
        '  Run in your terminal:\n\n' +
        '    cd cloud/equipos-worker && npx wrangler login\n\n' +
        '  Or set CLOUDFLARE_API_TOKEN (Workers + D1 + R2 edit).\n'
    );
    process.exit(1);
  }
}

function ensureDependencies() {
  log('Installing worker dependencies…');
  if (!fs.existsSync(path.join(WORKER_DIR, 'node_modules'))) {
    run('npm install', { cwd: WORKER_DIR });
  }
}

function ensureD1() {
  let toml = readToml();
  let dbId = getDatabaseId(toml);
  if (dbId && dbId !== 'REPLACE_WITH_D1_DATABASE_ID') {
    log(`D1 already configured: ${dbId}`);
    return dbId;
  }

  log(`Creating D1 database "${D1_NAME}"…`);
  const out = runCapture(`npx wrangler d1 create ${D1_NAME}`);
  console.log(out);

  const idMatch =
    /database_id\s*=\s*"([a-f0-9-]+)"/i.exec(out) ||
    /Created database[^\n]*\n[^\n]*id:\s*([a-f0-9-]+)/i.exec(out);
  if (!idMatch) {
    console.error(
      '\n✘ Could not parse database_id from wrangler output.\n' +
        '  Create manually: npx wrangler d1 create rplus-equipos\n' +
        '  Then paste database_id into cloud/equipos-worker/wrangler.toml\n'
    );
    process.exit(1);
  }

  dbId = idMatch[1];
  toml = setDatabaseId(readToml(), dbId);
  writeToml(toml);
  log(`Updated wrangler.toml → database_id = "${dbId}"`);
  return dbId;
}

function ensureR2() {
  log(`Creating R2 bucket "${R2_BUCKET}"…`);
  try {
    run(`npx wrangler r2 bucket create ${R2_BUCKET}`);
  } catch (e) {
    const msg = String(e.stderr || e.stdout || e.message || e);
    if (/already exists|AlreadyExists|409/i.test(msg)) {
      log('R2 bucket already exists — continuing.');
      return;
    }
    if (/10042|enable R2 through the Cloudflare Dashboard/i.test(msg)) {
      console.error(
        '\n✘ R2 is not enabled on your Cloudflare account yet.\n\n' +
          '  Enable it in the Dashboard (one-time, free tier includes 10 GB):\n\n' +
          '    1. Open https://dash.cloudflare.com → left sidebar → R2 object storage\n' +
          '    2. Click Get started / Enable R2 (accept terms if prompted)\n' +
          '    3. Create bucket → name: rplus-equipos-photos → Create\n' +
          '    4. Re-run: node cloudflare/setup.mjs\n\n' +
          '  Lumify/EKG photos and alert photos require R2; the queue API will not work without it.\n'
      );
      process.exit(1);
    }
    console.warn('R2 create warning:', msg);
  }
}

function migrateRemote() {
  log('Applying D1 schema (remote)…');
  run('npm run db:migrate:remote');
}

async function ensureAdminSecret() {
  log('Admin secret EQUIPOS_ADMIN_KEY');
  console.log(
    '  This key secures R+ desktop admin actions (rotate QR, purge).\n' +
      '  Use the same value in R+ → ⇄ → Equipos → Cola en Cloudflare.\n'
  );

  const existing = await prompt('Press Enter to set secret via wrangler (opens prompt), or type a key to use now: ');
  if (existing) {
    const child = spawnSync('npx', ['wrangler', 'secret', 'put', 'EQUIPOS_ADMIN_KEY'], {
      cwd: WORKER_DIR,
      input: existing,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    if (child.status !== 0) process.exit(child.status || 1);
    return;
  }
  run('npx wrangler secret put EQUIPOS_ADMIN_KEY');
}

function deploy() {
  log('Deploying worker + static assets…');
  run('npm run deploy');
}

function printWorkerUrl() {
  log('Done.');
  console.log(
    '\nNext steps:\n' +
      '  1. Note your Worker URL from the deploy output (or Dashboard → Workers → rplus-equipos).\n' +
      '  2. R+ desktop → ⇄ → Equipos → Cola en Cloudflare → URL + admin key → Guardar.\n' +
      '  3. Regenerar token → share QR with residents.\n' +
      '  4. Verify: curl https://YOUR-URL/api/equipos/v1/ping\n'
  );
}

async function main() {
  console.log('R+ Equipos — Cloudflare setup\n');
  if (!fs.existsSync(WORKER_DIR)) {
    console.error(`Missing worker dir: ${WORKER_DIR}`);
    process.exit(1);
  }

  ensureDependencies();
  ensureLoggedIn();
  ensureD1();
  ensureR2();
  migrateRemote();
  await ensureAdminSecret();
  deploy();
  printWorkerUrl();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
