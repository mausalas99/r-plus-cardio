/**
 * Nombres de artefactos según package.json → build.artifactName (${productName}-…).
 * Si el nombre lleva '+', electron-builder pone otra URL en latest*.yml (r-plus-…);
 * write-release-yml + afterAllArtifactBuild lo corrigen tras cada build.
 */
const path = require('path');

function getVersion(pkg) {
  return pkg.version || require(path.join(__dirname, '..', '..', 'package.json')).version;
}

function productName(pkg) {
  return (pkg.build && pkg.build.productName) || pkg.productName || 'R+';
}

/** @param {string} pattern  p.ej. ${productName}-${version}-${arch}.${ext} */
function expandArtifactPattern(pattern, version, arch, ext, pkg) {
  const pn = productName(pkg || {});
  const name = pkg?.name || 'r-plus';
  return String(pattern)
    .replace(/\$\{productName\}/g, pn)
    .replace(/\$\{name\}/g, name)
    .replace(/\$\{version\}/g, version)
    .replace(/\$\{arch\}/g, arch)
    .replace(/\$\{ext\}/g, String(ext).replace(/^\./, ''));
}

function getArtifactPattern(pkg) {
  const b = pkg.build || pkg;
  return b.artifactName || b.win?.artifactName || 'R-${version}-${arch}.${ext}';
}

function macArtifactNames(version, pattern, pkg) {
  const arches = ['arm64', 'x64'];
  const names = [];
  for (const arch of arches) {
    for (const ext of ['zip', 'dmg']) {
      names.push(expandArtifactPattern(pattern, version, arch, ext, pkg));
    }
  }
  return names;
}

function winArtifactName(version, pattern, pkg) {
  return expandArtifactPattern(pattern, version, 'x64', 'exe', pkg);
}

function allReleaseArtifactNames(pkg) {
  const version = getVersion(pkg);
  const pattern = getArtifactPattern(pkg);
  const mac = macArtifactNames(version, pattern, pkg);
  const win = winArtifactName(version, pattern, pkg);
  return {
    version,
    pattern,
    mac,
    win,
    all: [...mac, win],
  };
}

module.exports = {
  expandArtifactPattern,
  getArtifactPattern,
  macArtifactNames,
  winArtifactName,
  allReleaseArtifactNames,
};
