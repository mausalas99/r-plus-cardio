/**
 * Git helpers for release.js (stage paths, commit, preflight).
 */

const fs = require('fs');
const path = require('path');

/** Paths relativos al root; directorios con barra final. Se omiten los que no existan. */
const RELEASE_STAGE_PATHS = [
  'package.json',
  'package-lock.json',
  'README.md',
  'docs/',
  'data/release-notes-highlights.mjs',
  'stable-versions.json',
  'min-version.json',
  'main.js',
  'preload.js',
  'public/index.html',
  'public/index.src.html',
  'public/min-version.json',
  'public/js/',
  'public/partials/',
  'public/styles/',
  'lan-squad/',
  'generate-censo.js',
  'generate-censo.layout.test.js',
  'generate-censo.test.js',
  'lib/db/',
  'lib/entrega/',
  'lib/drive-import/',
  'lib/doc-generators/',
  'lib/doc-export-audit.js',
  'lib/doc-export-http.js',
  'lib/server-http-security.js',
  'lib/server-http-security.test.js',
  'lib/output-dir-policy.js',
  'lib/output-dir-policy.test.js',
  'server.js',
  'server-python.js',
  '.github/workflows/ci.yml',
  'scripts/build-ui.mjs',
  'scripts/build-ui.test.mjs',
  'scripts/lizard-ccn-report.mjs',
  'scripts/release.js',
  'scripts/lib/release-git.js',
  'scripts/lib/release-progress.js',
  'scripts/lib/electron-pack-files.js',
  'scripts/lib/electron-pack-files.test.js',
  'scripts/fetch-argon2-darwin-x64.mjs',
  'scripts/fetch-argon2-win.mjs',
  'scripts/fetch-sqlite-win.mjs',
  'scripts/fetch-sqlite-win.test.mjs',
  'scripts/fetch-sqlite-electron.mjs',
  'scripts/ensure-sqlcipher-electron-native.mjs',
  'scripts/ensure-native-db-for-node.mjs',
  'scripts/rebuild-native-db.mjs',
  'scripts/verify-release-natives.mjs',
  'scripts/lib/native-binary-format.mjs',
];

function releasePathExists(root, rel) {
  const full = path.join(root, rel.replace(/\/$/, ''));
  return fs.existsSync(full);
}

function existingReleaseStagePaths(root) {
  return RELEASE_STAGE_PATHS.filter((rel) => releasePathExists(root, rel));
}

function stageReleasePaths(execSync, root) {
  const paths = existingReleaseStagePaths(root);
  if (!paths.length) return;
  const r = require('child_process').spawnSync('git', ['add', '--', ...paths], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

function gitStatusPorcelain(execSync, root) {
  return execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
}

/** true si hay entradas en el índice (tras git add de paths de release). */
function hasStagedChanges(statusText) {
  return String(statusText || '')
    .split('\n')
    .some((line) => {
      if (!line.trim()) return false;
      const staged = line[0];
      return staged !== ' ' && staged !== '?';
    });
}

function assertReleaseNotesExist(fsMod, pathMod, root, version) {
  const file = pathMod.join(root, 'docs', `RELEASE_NOTES_${version}.txt`);
  if (!fsMod.existsSync(file)) {
    throw new Error(
      `Falta ${pathMod.relative(root, file)}. Ejecuta: npm run release:bump -- ${version}`
    );
  }
  return file;
}

function tagExists(execSync, root, version) {
  try {
    execSync(`git rev-parse v${version}`, { cwd: root, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function ghReleaseExists(spawnSync, repo, version) {
  const r = spawnSync('gh', ['release', 'view', `v${version}`, '--repo', repo], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return r.status === 0;
}

/**
 * @param {{ fs: typeof import('fs'), path: typeof import('path'), execSync: Function, spawnSync: Function, root: string, repo: string, version: string, allowExistingGh?: boolean }} ctx
 */
function assertPublishPreflight(ctx) {
  const { fs: fsMod, path: pathMod, execSync, spawnSync, root, repo, version, allowExistingGh } = ctx;
  assertReleaseNotesExist(fsMod, pathMod, root, version);

  if (tagExists(execSync, root, version) && !allowExistingGh) {
    throw new Error(
      `El tag v${version} ya existe en git. Republicar en el mismo tag: npm run release:publish -- --yes --allow-existing-gh`
    );
  }

  if (!allowExistingGh && ghReleaseExists(spawnSync, repo, version)) {
    throw new Error(
      `GitHub release v${version} ya existe en ${repo}. ` +
        `Sube artefactos con «gh release upload v${version} …» o elimina el release en GitHub, o usa --allow-existing-gh.`
    );
  }
}

module.exports = {
  RELEASE_STAGE_PATHS,
  existingReleaseStagePaths,
  stageReleasePaths,
  gitStatusPorcelain,
  hasStagedChanges,
  assertReleaseNotesExist,
  tagExists,
  ghReleaseExists,
  assertPublishPreflight,
};
