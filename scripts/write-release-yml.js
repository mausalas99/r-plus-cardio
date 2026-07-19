#!/usr/bin/env node
/**
 * Regenera dist/latest-mac.yml y dist/latest.yml desde los binarios en dist/.
 *
 * electron-builder escribe latest-*.yml con safeArtifactName (r-plus-…-mac.zip)
 * cuando artifactName lleva '+' (R+-…); el auto-updater busca esa URL y da 404.
 *
 * Con artifactName GitHub-safe (R-${version}-${arch}) los yml suelen ser correctos;
 * este script sigue necesario para unificar arm64+x64 y listar todos los archivos.
 *
 * Uso:
 *   node scripts/write-release-yml.js            → Mac + Windows (todo en dist/)
 *   node scripts/write-release-yml.js --auto     → según lo que exista en dist/
 *   node scripts/write-release-yml.js --mac-only
 *   node scripts/write-release-yml.js --win-only
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { macArtifactNames, winArtifactName, getArtifactPattern } = require('./lib/artifact-names');
const { releaseNotesPlainFromDoc } = require('./lib/release-notes-plain');

const argv = process.argv.slice(2);
const auto = argv.includes('--auto');
let macOnly = argv.includes('--mac-only');
let winOnly = argv.includes('--win-only');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const ver = pkg.version;
const dist = path.join(root, 'dist');
const pattern = getArtifactPattern(pkg);

function sha512b64(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha512').update(buf).digest('base64');
}

function need(rel) {
  const abs = path.join(dist, rel);
  if (!fs.existsSync(abs)) {
    console.error('Falta el archivo:', abs);
    process.exit(1);
  }
  return abs;
}

function exists(rel) {
  return fs.existsSync(path.join(dist, rel));
}

function isoDate() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

if (auto) {
  const hasMac = macArtifactNames(ver, pattern, pkg).some((n) => exists(n));
  const hasWin = exists(winArtifactName(ver, pattern, pkg));
  macOnly = hasMac && !hasWin;
  winOnly = hasWin && !hasMac;
  if (!macOnly && !winOnly && !hasMac && !hasWin) {
    console.log('write-release-yml --auto: nada que actualizar en dist/');
    process.exit(0);
  }
}

if (macOnly && winOnly) {
  console.error('Usa solo uno de --mac-only o --win-only');
  process.exit(1);
}

const macNames = macArtifactNames(ver, pattern, pkg);

if (!winOnly) {
  const lines = [];
  lines.push(`version: ${ver}`);
  lines.push('files:');
  for (const url of macNames) {
    const abs = need(url);
    lines.push(`  - url: ${url}`);
    lines.push(`    sha512: ${sha512b64(abs)}`);
    lines.push(`    size: ${fs.statSync(abs).size}`);
  }
  const zipPrimary = macNames.find((n) => n.endsWith('-arm64.zip')) || macNames.find((n) => n.endsWith('.zip'));
  const zipAbs = need(zipPrimary);
  lines.push(`path: ${zipPrimary}`);
  lines.push(`sha512: ${sha512b64(zipAbs)}`);
  lines.push(`releaseDate: '${isoDate()}'`);
  const releaseNotes = releaseNotesPlainFromDoc(root, ver);
  if (releaseNotes) {
    lines.push('releaseNotes: |');
    for (const line of releaseNotes.split('\n')) {
      lines.push(`  ${line}`);
    }
  }
  lines.push('');

  fs.writeFileSync(path.join(dist, 'latest-mac.yml'), lines.join('\n'), 'utf8');
  console.log('Escrito dist/latest-mac.yml');
}

if (!macOnly) {
  const winName = winArtifactName(ver, pattern, pkg);
  const winAbs = need(winName);
  const winSha = sha512b64(winAbs);
  const winSize = fs.statSync(winAbs).size;
  const winLines = [
    `version: ${ver}`,
    'files:',
    `  - url: ${winName}`,
    `    sha512: ${winSha}`,
    `    size: ${winSize}`,
    `path: ${winName}`,
    `sha512: ${winSha}`,
    `releaseDate: '${isoDate()}'`,
  ];
  const releaseNotes = releaseNotesPlainFromDoc(root, ver);
  if (releaseNotes) {
    winLines.push('releaseNotes: |');
    for (const line of releaseNotes.split('\n')) {
      winLines.push(`  ${line}`);
    }
  }
  winLines.push('');
  fs.writeFileSync(path.join(dist, 'latest.yml'), winLines.join('\n'), 'utf8');
  console.log('Escrito dist/latest.yml');
}
