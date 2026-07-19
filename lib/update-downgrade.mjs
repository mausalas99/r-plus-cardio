export const GITHUB_RELEASES_BASE =
  'https://github.com/mausalas99/r-mas/releases/download';
export const STABLE_VERSIONS_RAW_URL =
  'https://raw.githubusercontent.com/mausalas99/r-mas/main/stable-versions.json';

export function parseSemverCore(version) {
  const m = String(version || '')
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-.+].*)?$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

export function compareSemverCore(a, b) {
  const pa = parseSemverCore(a);
  const pb = parseSemverCore(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

export function isValidDowngradeTargetVersion(target, current) {
  if (!parseSemverCore(target) || !parseSemverCore(current)) return false;
  return compareSemverCore(target, current) < 0;
}

export function buildGenericFeedUrl(version) {
  const v = String(version || '').replace(/^v/, '');
  if (!parseSemverCore(v)) throw new Error(`Versión inválida: ${version}`);
  return `${GITHUB_RELEASES_BASE}/v${v}/`;
}

export function pickMacArch(arch) {
  return arch === 'arm64' ? 'arm64' : 'x64';
}

export function buildManualInstallerUrl(version, platform, arch) {
  const v = String(version || '').replace(/^v/, '');
  if (!parseSemverCore(v)) throw new Error(`Versión inválida: ${version}`);
  const macArch = pickMacArch(arch);
  let fileName;
  if (platform === 'darwin') {
    fileName = `R+-${v}-${macArch}.dmg`;
  } else if (platform === 'win32') {
    fileName = `R+-${v}-x64.exe`;
  } else {
    throw new Error(`Plataforma no soportada: ${platform}`);
  }
  return `${GITHUB_RELEASES_BASE}/v${v}/${fileName}`;
}

export function filterDowngradeCandidates(entries, currentVersion) {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .filter((e) => e && isValidDowngradeTargetVersion(e.version, currentVersion))
    .sort((a, b) => compareSemverCore(b.version, a.version));
}
