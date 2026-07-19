#!/usr/bin/env node
/**
 * Release en dos pasos para R+ (mausalas99/r-mas).
 *
 *   npm run release:bump -- 3.4.3
 *   npm run release:bump -- patch|minor|major
 *   npm run release:bump -- 3.5 --title "estable — título corto"
 *
 *   npm run release:publish
 *   npm run release:publish -- --yes
 *   npm run release:publish -- --mac-only
 *   npm run release:publish -- --skip-build
 *
 * Parte 1 (bump): versión, RELEASE_NOTES, README, stub in-app highlights.
 *   npm run release:bump -- 6.4.1 --commit   → opcional: commit del bump
 *
 * Parte 2 (publish): preflight → sync build.files → commit pendiente → tests → commit → push → build → tag → gh release.
 *   npm run release:publish -- --yes
 *   npm run release:publish -- --skip-pre-commit   (no commit automático antes de tests)
 *
 * Tras bump, edita docs/RELEASE_NOTES_X.Y.Z.txt, README y data/release-notes-highlights.mjs.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync, spawn } = require('child_process');
const readline = require('readline');
const { buildPublishSteps, createReleaseProgress } = require('./lib/release-progress');
const { applyBuildLogLine, resetBuildLogState } = require('./lib/release-build-log');
const { prepareMacSigning } = require('./lib/mac-signing-prep');
const {
  stageReleasePaths,
  gitStatusPorcelain,
  hasStagedChanges,
  assertPublishPreflight,
  ghReleaseExists,
  tagExists,
} = require('./lib/release-git');
const { ensureElectronPackFiles } = require('./lib/electron-pack-files');
const { curatedConstName } = require('./lib/release-notes-body');

const ROOT = path.join(__dirname, '..');
const REPO = 'mausalas99/r-mas';
const { allReleaseArtifactNames } = require('./lib/artifact-names');
const APP_JS = path.join(ROOT, 'public/js/app.js');
const RELEASE_NOTES_HIGHLIGHTS = path.join(ROOT, 'data/release-notes-highlights.mjs');
const README = path.join(ROOT, 'README.md');

function run(cmd, opts = {}) {
  console.log('\n→', cmd);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function gitCommit(message) {
  console.log('\n→ git commit -m', JSON.stringify(message));
  const r = spawnSync('git', ['commit', '-m', message], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

function gitTag(tag, message) {
  console.log('\n→ git tag -a', tag);
  const r = spawnSync('git', ['tag', '-a', tag, '-m', message], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function parseSemver(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function bumpSemver(current, kind) {
  const p = parseSemver(current);
  if (!p) throw new Error(`Versión actual inválida: ${current}`);
  if (kind === 'patch') return `${p.major}.${p.minor}.${p.patch + 1}`;
  if (kind === 'minor') return `${p.major}.${p.minor + 1}.0`;
  if (kind === 'major') return `${p.major + 1}.0.0`;
  throw new Error(`Incremento desconocido: ${kind}`);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function resolveTargetVersion(argv) {
  const pkg = readJson('package.json');
  const current = pkg.version;
  const positional = argv.filter((a) => !a.startsWith('-'));

  if (positional.length === 0) {
    return promptVersion(current);
  }

  const arg = positional[0];
  if (['patch', 'minor', 'major'].includes(arg)) {
    return Promise.resolve(bumpSemver(current, arg));
  }
  if (!parseSemver(arg)) {
    throw new Error(`Versión inválida: ${arg} (usa X.Y.Z o patch|minor|major)`);
  }
  return Promise.resolve(arg);
}

function promptVersion(current) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log(`Versión actual: ${current}`);
    rl.question('Nueva versión (X.Y.Z) o patch / minor / major: ', (answer) => {
      rl.close();
      const t = String(answer).trim();
      if (['patch', 'minor', 'major'].includes(t)) {
        resolve(bumpSemver(current, t));
        return;
      }
      if (!parseSemver(t)) {
        console.error('Entrada inválida.');
        process.exit(1);
      }
      resolve(t);
    });
  });
}

function getArg(argv, name, fallback = '') {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  return argv[i + 1] || fallback;
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function hasScript(name) {
  const scripts = readJson('package.json').scripts || {};
  return typeof scripts[name] === 'string' && scripts[name].trim().length > 0;
}

function buildMacPublishCmd() {
  return 'npm run build:mac';
}

function buildWinPublishCmd() {
  return 'npm run build:win';
}

function writeReleaseNotes(version, title) {
  const file = path.join(ROOT, 'docs', `RELEASE_NOTES_${version}.txt`);
  if (fs.existsSync(file)) {
    console.log(`Ya existe ${path.relative(ROOT, file)} — no se sobrescribe.`);
    return;
  }
  const body = `R+ ${version} (${title})
${'='.repeat(Math.min(60, 10 + version.length + title.length))}

Fecha: ${todayIso()}

## Resumen

TODO: resumen en una o dos frases.

## Nuevo / mejorado

- **TODO:** punto 1
- **TODO:** punto 2

## Instalación

Descarga desde: https://github.com/${REPO}/releases/tag/v${version}

- Mac: \`R+-${version}-arm64.dmg\`, \`R+-${version}-x64.dmg\` (y zip para auto-update).
- Windows: \`R+-${version}-x64.exe\`.

Tras el build local: \`npm run build:mac\` / \`npm run build:win\` (incluye write-release-yml.js).
`;
  fs.writeFileSync(file, body, 'utf8');
  console.log('Creado', path.relative(ROOT, file));
}

function updateReadme(version, title) {
  let text = fs.readFileSync(README, 'utf8');
  const stableRe = /\*\*Versión estable actual:\*\* \[[^\]]+\]\([^)]+\)[^\n]*/;
  if (!stableRe.test(text)) {
    throw new Error('README.md: no se encontró la línea «Versión estable actual».');
  }
  text = text.replace(
    stableRe,
    `**Versión estable actual:** [${version}](https://github.com/${REPO}/releases/tag/v${version}) — en *Releases* verás siempre el instalador más reciente con el número de versión en el nombre del archivo.`
  );

  const section = `## R+ ${version} (${title})`;
  if (!text.includes(section)) {
    const block = [
      '',
      section,
      '',
      '- **TODO:** completar bullets en README.',
      '',
      `Notas: \`docs/RELEASE_NOTES_${version}.txt\`.`,
      '',
    ].join('\n');
    const insertRe =
      /(\*\*Versión estable actual:\*\*[^\n]*\n\n---\n\n)(## R\+ [\d.]+)/;
    if (!insertRe.test(text)) {
      throw new Error(
        'README.md: no se encontró el bloque de versiones (Versión estable / --- / ## R+).'
      );
    }
    text = text.replace(insertRe, `$1${block}$2`);
  }
  fs.writeFileSync(README, text, 'utf8');
  console.log('Actualizado README.md');
}

function updateHighlightsStub(version) {
  let text = fs.readFileSync(RELEASE_NOTES_HIGHLIGHTS, 'utf8');
  const constName = curatedConstName(version);
  const key = `'${version}':`;
  if (text.includes(key)) {
    console.log('release-notes-highlights.mjs ya tiene RELEASE_NOTES_HIGHLIGHTS para', version);
    return;
  }
  const varBlock = `var ${constName} = [
  {
    title: 'TODO',
    body: 'Completar antes de publicar.',
  },
  {
    title: 'TODO',
    body: 'Completar antes de publicar.',
  },
];

`;
  const mapEntry = `  '${version}': ${constName},\n`;
  const fallbackMarker = '/** Fallback when a version has no curated entry';
  if (!text.includes(fallbackMarker)) {
    throw new Error('data/release-notes-highlights.mjs: no se encontró marcador FALLBACK.');
  }
  text = text.replace(fallbackMarker, varBlock + fallbackMarker);
  const marker = 'export var RELEASE_NOTES_HIGHLIGHTS = {\n';
  if (!text.includes(marker)) {
    throw new Error('data/release-notes-highlights.mjs: no se encontró RELEASE_NOTES_HIGHLIGHTS.');
  }
  text = text.replace(marker, marker + mapEntry);
  fs.writeFileSync(RELEASE_NOTES_HIGHLIGHTS, text, 'utf8');
  console.log('Añadido stub', constName, 'en data/release-notes-highlights.mjs');
}

function updateHighlightsDefault(version) {
  let text = fs.readFileSync(RELEASE_NOTES_HIGHLIGHTS, 'utf8');
  const constName = curatedConstName(version);
  const re = /export var RELEASE_NOTES_HIGHLIGHTS_DEFAULT = RELEASE_NOTES_\d+;/;
  if (!re.test(text)) {
    throw new Error('data/release-notes-highlights.mjs: no se encontró RELEASE_NOTES_HIGHLIGHTS_DEFAULT.');
  }
  if (!text.includes(`var ${constName} =`)) {
    throw new Error(
      `data/release-notes-highlights.mjs: falta var ${constName} — completa highlights antes del bump.`
    );
  }
  text = text.replace(re, `export var RELEASE_NOTES_HIGHLIGHTS_DEFAULT = ${constName};`);
  fs.writeFileSync(RELEASE_NOTES_HIGHLIGHTS, text, 'utf8');
  console.log('Actualizado RELEASE_NOTES_HIGHLIGHTS_DEFAULT →', constName);
}

function readReleaseTitle(version) {
  const file = path.join(ROOT, 'docs', `RELEASE_NOTES_${version}.txt`);
  if (!fs.existsSync(file)) return `estable — release ${version}`;
  const first = fs.readFileSync(file, 'utf8').split('\n')[0].trim();
  const m = first.match(/^R\+\s+[\d.]+\s+\((.+)\)\s*$/);
  return m ? m[1] : `estable — release ${version}`;
}

async function cmdBump(argv) {
  const version = await resolveTargetVersion(argv);
  const title =
    getArg(argv, '--title') ||
    getArg(argv, '-t') ||
    `estable — release ${version}`;

  const pkg = readJson('package.json');
  if (pkg.version === version) {
    console.log('package.json ya está en', version);
  } else {
    run(`npm version ${version} --no-git-tag-version`);
  }

  writeReleaseNotes(version, title);
  updateReadme(version, title);
  updateHighlightsStub(version);
  updateHighlightsDefault(version);

  const packSync = ensureElectronPackFiles(ROOT, { write: true });
  if (packSync.changed) {
    console.log('Actualizado package.json → build.files (lista canónica electron-pack-files).');
  }

  if (hasFlag(argv, '--commit')) {
    stageReleasePaths(execSync, ROOT);
    const status = gitStatusPorcelain(execSync, ROOT);
    if (hasStagedChanges(status)) {
      gitCommit(`chore(release): bump ${version}`);
    } else {
      console.log('Nada que commitear tras el bump (árbol limpio en paths de release).');
    }
  }

  console.log(`
── Parte 1 lista: ${version} ──
Edita antes de publish:
  • docs/RELEASE_NOTES_${version}.txt
  • README.md (bullets de ## R+ ${version})
  • data/release-notes-highlights.mjs (RELEASE_NOTES_HIGHLIGHTS['${version}'])

Luego:
  npm run release:publish -- --yes
`);
}

function confirm(question, yesFlag) {
  if (yesFlag) return Promise.resolve(true);
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (a) => {
      rl.close();
      resolve(/^y(es)?$/i.test(String(a).trim()));
    });
  });
}

function distFiles(version, { macOnly, winOnly }) {
  const pkg = readJson('package.json');
  const { mac, win } = allReleaseArtifactNames(pkg);
  const names = [];
  if (!winOnly) {
    for (const base of mac) {
      names.push(base, `${base}.blockmap`);
    }
    names.push('latest-mac.yml');
  }
  if (!macOnly) {
    names.push(win, `${win}.blockmap`, 'latest.yml');
  }
  return names.map((n) => path.join(ROOT, 'dist', n));
}

function assertDist(version, opts) {
  const missing = distFiles(version, opts).filter((f) => !fs.existsSync(f));
  if (missing.length) {
    console.error('Faltan artefactos en dist/:');
    missing.forEach((f) => console.error(' ', path.relative(ROOT, f)));
    process.exit(1);
  }
}

function verifyYmlNames(version) {
  const pkg = readJson('package.json');
  const { mac, win } = allReleaseArtifactNames(pkg);
  const expectZip = mac.find((n) => n.endsWith('-arm64.zip'));
  const macYml = path.join(ROOT, 'dist', 'latest-mac.yml');
  const winYml = path.join(ROOT, 'dist', 'latest.yml');
  if (fs.existsSync(macYml)) {
    const t = fs.readFileSync(macYml, 'utf8');
    if (t.includes('r-plus-') || (expectZip && !t.includes(expectZip))) {
      console.warn('⚠ latest-mac.yml incorrecto. Ejecuta: node scripts/write-release-yml.js --auto');
    }
  }
  if (fs.existsSync(winYml)) {
    const t = fs.readFileSync(winYml, 'utf8');
    if (t.includes('r-plus-') || !t.includes(win)) {
      console.warn('⚠ latest.yml incorrecto. Ejecuta: node scripts/write-release-yml.js --auto');
    }
  }
}

function commitMessage(version) {
  const title = readReleaseTitle(version);
  const short = title.replace(/^estable\s*—\s*/i, '').trim() || title;
  return `release: R+ ${version} — ${short}`;
}

function streamChildLines(stream, onLine) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) onLine(line);
  });
  return () => {
    if (buf.trim()) onLine(buf);
  };
}

function runPublishCmd(progress, stepId, cmd) {
  progress.start(stepId);
  progress.logCommand(cmd);

  if (!progress.jsonMode) {
    if (stepId === 'build-mac') {
      try {
        prepareMacSigning(process.env);
      } catch (err) {
        console.error('Firma Mac:', err.message || err);
        throw err;
      }
    }
    try {
      execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
      progress.complete(stepId);
    } catch (err) {
      progress.fail(stepId);
      throw err;
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    resetBuildLogState();
    if (stepId === 'build-mac') {
      try {
        const prep = prepareMacSigning(process.env);
        if (prep.unlocked) {
          progress.emitLog({ stream: 'meta', line: 'Llavero Mac desbloqueado para codesign.' });
        }
        if (prep.notarize) {
          progress.emitLog({ stream: 'meta', line: 'Notarización Apple activa (APPLE_ID en entorno).' });
        } else if (prep.signed) {
          progress.emitLog({ stream: 'meta', line: 'Build Mac firmado (certificado / llavero).' });
        }
      } catch (err) {
        progress.emitLog({
          stream: 'stderr',
          line: `Firma Mac: ${err.message || err}`,
        });
        progress.fail(stepId);
        reject(err);
        return;
      }
    }
    const child = spawn(cmd, {
      cwd: ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const onLine = (line, stream) => {
      applyBuildLogLine(progress, stepId, line);
      progress.emitLog({ stream, line });
    };

    const flushOut = streamChildLines(child.stdout, (line) => onLine(line, 'stdout'));
    const flushErr = streamChildLines(child.stderr, (line) => onLine(line, 'stderr'));

    const isBuild = stepId === 'build-mac' || stepId === 'build-win';
    let heartbeatPct = 12;
    const heartbeat = isBuild
      ? setInterval(() => {
          heartbeatPct = Math.min(90, heartbeatPct + 3);
          progress.subProgress(stepId, heartbeatPct, 'Compilando… (puede tardar varios minutos)');
        }, 30000)
      : null;

    child.on('close', (code) => {
      if (heartbeat) clearInterval(heartbeat);
      flushOut();
      flushErr();
      if (code === 0) {
        progress.complete(stepId);
        resolve();
      } else {
        const line = `${cmd} falló (código ${code}). Revisa el log.`;
        progress.emitLog({ stream: 'stderr', line });
        progress.fail(stepId);
        reject(Object.assign(new Error(line), { status: code }));
      }
    });
    child.on('error', (err) => {
      if (heartbeat) clearInterval(heartbeat);
      progress.fail(stepId);
      reject(err);
    });
  });
}

async function cmdPublish(argv) {
  const yes = hasFlag(argv, '--yes') || hasFlag(argv, '-y');
  const skipTests = hasFlag(argv, '--skip-tests');
  const skipBuild = hasFlag(argv, '--skip-build');
  const skipPush = hasFlag(argv, '--skip-push');
  const skipGh = hasFlag(argv, '--no-gh');
  const macOnly = hasFlag(argv, '--mac-only');
  const winOnly = hasFlag(argv, '--win-only');
  const noManifestCommit = hasFlag(argv, '--no-manifest-commit');
  const skipCommit = hasFlag(argv, '--skip-commit');
  const skipPreCommit = hasFlag(argv, '--skip-pre-commit');
  const allowExistingGh = hasFlag(argv, '--allow-existing-gh');
  const progressJson = hasFlag(argv, '--progress-json');

  if (macOnly && winOnly) {
    console.error('Usa solo uno de --mac-only o --win-only');
    process.exit(1);
  }

  const version = readJson('package.json').version;
  const notesFile = path.join(ROOT, 'docs', `RELEASE_NOTES_${version}.txt`);
  if (!fs.existsSync(notesFile)) {
    console.error(`Falta ${path.relative(ROOT, notesFile)}. Ejecuta primero: npm run release:bump -- ${version}`);
    process.exit(1);
  }

  try {
    assertPublishPreflight({
      fs,
      path,
      execSync,
      spawnSync,
      root: ROOT,
      repo: REPO,
      version,
      allowExistingGh,
    });
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }

  const notesText = fs.readFileSync(notesFile, 'utf8');
  if (/\bTODO\b|TODO:|title: 'TODO'|\*\*TODO:\*\*/i.test(notesText)) {
    const warn = '⚠ RELEASE_NOTES contiene TODO — revisa antes de continuar.';
    if (progressJson) {
      process.stdout.write(`${JSON.stringify({ type: 'log', stream: 'stderr', line: warn })}\n`);
    } else {
      console.warn(warn);
    }
  }
  const highlightsText = fs.readFileSync(RELEASE_NOTES_HIGHLIGHTS, 'utf8');
  if (new RegExp(`'${version}':[\\s\\S]*?title: 'TODO'`).test(highlightsText)) {
    const warn =
      '⚠ RELEASE_NOTES_HIGHLIGHTS aún tiene TODO — revisa data/release-notes-highlights.mjs.';
    if (progressJson) {
      process.stdout.write(`${JSON.stringify({ type: 'log', stream: 'stderr', line: warn })}\n`);
    } else {
      console.warn(warn);
    }
  }

  if (progressJson) {
    process.stdout.write(
      `${JSON.stringify({
        type: 'meta',
        version,
        title: `R+ ${version} (${readReleaseTitle(version)})`,
      })}\n`
    );
  } else {
    console.log(`\nPublicar R+ ${version} (${readReleaseTitle(version)})\n`);
  }

  if (!(await confirm('¿Continuar con tests, commit, builds y GitHub release?', yes))) {
    if (progressJson) process.stdout.write(`${JSON.stringify({ type: 'cancelled' })}\n`);
    console.log('Cancelado.');
    process.exit(0);
  }

  const progress = createReleaseProgress(
    buildPublishSteps({
      skipTests,
      skipCommit,
      skipPreCommit,
      skipPush,
      skipBuild,
      macOnly,
      winOnly,
      skipGh,
      noManifestCommit,
    }),
    { jsonMode: progressJson }
  );

  const tag = `v${version}`;

  try {
    progress.start('preflight');
    const line = `Versión ${version} · tag ${tag} libre · notas en ${path.relative(ROOT, notesFile)}`;
    if (progressJson) progress.emitLog({ stream: 'meta', line });
    else console.log(line);
    progress.complete('preflight');

    progress.start('pack-files');
    const packSync = ensureElectronPackFiles(ROOT, { write: true });
    const packLine = packSync.changed
      ? `build.files actualizado (+${packSync.missing.length} / -${packSync.extra.length})`
      : 'build.files ya coincide con server.js + lan-squad';
    if (progressJson) progress.emitLog({ stream: 'meta', line: packLine });
    else console.log(packLine);
    progress.complete('pack-files');

    if (!skipPreCommit) {
      progress.start('pre-commit');
      stageReleasePaths(execSync, ROOT);
      const pending = gitStatusPorcelain(execSync, ROOT);
      if (hasStagedChanges(pending)) {
        gitCommit(`chore(release): prepare ${version}`);
      } else {
        const msg =
          'Sin cambios en paths de release para commitear (p. ej. dist/ o plugins sucios se ignoran aquí).';
        if (progressJson) progress.emitLog({ stream: 'meta', line: msg });
        else console.log(msg);
      }
      progress.complete('pre-commit');
    } else {
      progress.skip('pre-commit');
    }

    if (!skipTests) {
      await runPublishCmd(
        progress,
        'native-restore',
        'R_PLUS_STRICT_NATIVE=1 node scripts/rebuild-native-db.mjs'
      );
      await runPublishCmd(progress, 'tests', 'npm test');
    } else {
      progress.skip('native-restore');
      progress.skip('tests');
    }

    if (!skipCommit) {
      progress.start('git-commit');
      stageReleasePaths(execSync, ROOT);
      const status = gitStatusPorcelain(execSync, ROOT);
      if (hasStagedChanges(status)) {
        gitCommit(commitMessage(version));
      } else {
        const line = 'Nada que commitear (working tree limpio para paths de release).';
        if (progressJson) {
          progress.emitLog({ stream: 'meta', line });
        } else {
          console.log(line);
        }
      }
      progress.complete('git-commit');
    }

    if (!skipPush) await runPublishCmd(progress, 'git-push', 'git push origin main');

    if (!skipBuild) {
      await runPublishCmd(
        progress,
        'verify-natives',
        'R_PLUS_STRICT_NATIVE=1 node scripts/fetch-sqlite-electron.mjs && R_PLUS_STRICT_NATIVE=1 npm run rebuild:db-native && node scripts/verify-release-natives.mjs'
      );
      if (!winOnly) await runPublishCmd(progress, 'build-mac', buildMacPublishCmd());
      if (!macOnly) await runPublishCmd(progress, 'build-win', buildWinPublishCmd());
    } else {
      progress.skip('verify-natives');
      progress.emitLog({ stream: 'meta', line: '--skip-build: se asume dist/ ya generado.' });
      progress.skip('build-mac');
      progress.skip('build-win');
      progress.skip('verify-dist');
      progress.skip('verify-natives');
    }

    if (!skipBuild) {
      progress.start('verify-dist');
      assertDist(version, { macOnly, winOnly });
      verifyYmlNames(version);
      progress.complete('verify-dist');
    }

    progress.start('git-tag');
    let tagCreated = false;
    let tagForcePush = false;
    const tagMsg = commitMessage(version);
    const tagAlreadyExists = tagExists(execSync, ROOT, version);
    if (tagAlreadyExists && allowExistingGh) {
      const line = `Tag ${tag} ya existe — se mueve a HEAD (--allow-existing-gh).`;
      if (progressJson) progress.emitLog({ stream: 'meta', line });
      else console.log(line);
      execSync(`git tag -f -a ${tag} -m ${JSON.stringify(tagMsg)}`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
      tagCreated = true;
      tagForcePush = true;
    } else if (!tagAlreadyExists) {
      gitTag(tag, tagMsg);
      tagCreated = true;
    } else {
      const line = `Tag ${tag} ya existe — no se recrea.`;
      if (progressJson) progress.emitLog({ stream: 'meta', line });
      else console.log(line);
    }
    progress.complete('git-tag');

    if (!skipPush && tagCreated) {
      const pushTagCmd = tagForcePush ? `git push origin ${tag} --force` : `git push origin ${tag}`;
      await runPublishCmd(progress, 'git-push-tag', pushTagCmd);
    } else if (!skipPush) {
      progress.skip('git-push-tag');
    }

    if (!skipGh) {
      progress.start('gh-release');
      const assets = distFiles(version, { macOnly, winOnly }).map((f) => path.relative(ROOT, f));
      const uploadOnly = ghReleaseExists(spawnSync, REPO, version);
      const ghArgs = uploadOnly
        ? ['release', 'upload', tag, '--repo', REPO, ...assets, '--clobber']
        : [
            'release',
            'create',
            tag,
            '--repo',
            REPO,
            '--title',
            `R+ ${version}`,
            '--notes-file',
            `docs/RELEASE_NOTES_${version}.txt`,
            ...assets,
          ];
      progress.logCommand(`gh ${ghArgs.join(' ')}`);
      const created = spawnSync('gh', ghArgs, {
        cwd: ROOT,
        stdio: progressJson ? 'pipe' : 'inherit',
        encoding: 'utf8',
      });
      if (progressJson && created.stdout) {
        for (const line of String(created.stdout).split('\n')) {
          if (line.trim()) progress.emitLog({ stream: 'stdout', line });
        }
      }
      if (progressJson && created.stderr) {
        for (const line of String(created.stderr).split('\n')) {
          if (line.trim()) progress.emitLog({ stream: 'stderr', line });
        }
      }
      if (created.status !== 0) {
        const hint = `gh release upload ${tag} --repo ${REPO} ${assets.join(' ')} --clobber`;
        progress.emitLog({ stream: 'stderr', line: `Si el release ya existe: ${hint}` });
        progress.fail('gh-release');
        process.exit(created.status || 1);
      }
      progress.complete('gh-release');
      try {
        const { upsertStableVersionEntry } = require('../lib/stable-versions-catalog');
        const catalogPath = path.join(ROOT, 'stable-versions.json');
        upsertStableVersionEntry(catalogPath, {
          version,
          summary: `Release estable ${version}`,
          recommended: true,
        });
        const catalogLine = `stable-versions.json actualizado para v${version}`;
        if (progressJson) progress.emitLog({ stream: 'meta', line: catalogLine });
        else console.log('\n→', catalogLine);
      } catch (catalogErr) {
        const warn = `No se pudo actualizar stable-versions.json: ${catalogErr && catalogErr.message ? catalogErr.message : catalogErr}`;
        if (progressJson) progress.emitLog({ stream: 'stderr', line: warn });
        else console.warn(warn);
      }
    }

    if (!noManifestCommit && !skipPush) {
      const hasYml =
        fs.existsSync(path.join(ROOT, 'dist', 'latest-mac.yml')) ||
        fs.existsSync(path.join(ROOT, 'dist', 'latest.yml'));
      if (hasYml && (await confirm('¿Commitear latest*.yml en main (-f dist/)?', yes))) {
        progress.start('manifest-commit');
        run('git add -f dist/latest-mac.yml dist/latest.yml');
        run(`git commit -m "chore(release): publish ${version} update manifests"`);
        await runPublishCmd(progress, 'manifest-commit', 'git push origin main');
      } else {
        progress.skip('manifest-commit');
      }
    }

    progress.finish();

    if (!progressJson) {
      console.log(`
── Parte 2 lista: ${version} ──
Verificar:
  gh release view ${tag} --repo ${REPO} --json assets --jq '.assets[].name'
  curl -sL "https://github.com/${REPO}/releases/download/${tag}/latest-mac.yml" | head -8
`);
    }
  } catch (err) {
    if (err && err.status) process.exit(err.status);
    process.exit(1);
  }
}

function main() {
  const [,, sub, ...rest] = process.argv;
  if (!sub || sub === '--help' || sub === '-h') {
    console.log(`Uso:
  node scripts/release.js bump [VERSION|patch|minor|major] [--title "estable — …"]
  node scripts/release.js publish [--yes] [--progress-json] [--mac-only|--win-only] [--skip-build] [--skip-push] [--no-gh]
    [--skip-pre-commit] [--allow-existing-gh]

npm:
  npm run release:bump -- 6.4.1 --commit
  npm run release:publish -- --yes
  npm run release:republish   # mismo tag/release en GitHub (sube artefactos con --clobber)
`);
    process.exit(sub ? 0 : 1);
  }
  if (sub === 'bump') {
    cmdBump(rest).catch((e) => {
      console.error(e.message || e);
      process.exit(1);
    });
    return;
  }
  if (sub === 'publish') {
    cmdPublish(rest).catch((e) => {
      console.error(e.message || e);
      process.exit(1);
    });
    return;
  }
  console.error('Subcomando desconocido:', sub);
  process.exit(1);
}

main();
