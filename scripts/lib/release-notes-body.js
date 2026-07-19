/**
 * Plain-text release notes for tooling (parity with in-app curated highlights).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return String(pkg.version || '').trim();
}

/** @param {string} version semver X.Y.Z */
function curatedConstName(version) {
  return `RELEASE_NOTES_${String(version).trim().replace(/\./g, '')}`;
}

/**
 * @param {string} version
 * @returns {Promise<string>}
 */
async function formatCuratedReleaseNotesPlain(version) {
  const mod = await import(
    path.join(ROOT, 'public/js/features/settings-help/release-notes-curated.mjs')
  );
  const notes =
    (version && mod.RELEASE_NOTES_HIGHLIGHTS[version]) ||
    mod.RELEASE_NOTES_HIGHLIGHTS_DEFAULT ||
    [];
  return notes
    .map((n) => {
      const title = n.title ? String(n.title).trim() : '';
      const body = String(n.body || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (title && body) return `${title} — ${body}`;
      return title || body;
    })
    .filter(Boolean)
    .join('\n\n');
}

module.exports = {
  readPackageVersion,
  curatedConstName,
  formatCuratedReleaseNotesPlain,
};
