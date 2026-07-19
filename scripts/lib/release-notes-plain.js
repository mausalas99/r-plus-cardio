'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Plain-text bullets for auto-updater (latest-mac.yml releaseNotes).
 * @param {string} root
 * @param {string} version
 */
function extractSection(text, heading) {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?:\\n## |\\s*$)`);
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function bulletsToPlain(block) {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) =>
      line
        .replace(/^- \*\*([^*]+)\*\* — /, '$1 — ')
        .replace(/^- /, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .trim()
    )
    .filter(Boolean)
    .join('\n\n');
}

function releaseNotesPlainFromDoc(root, version) {
  const notesPath = path.join(root, 'docs', `RELEASE_NOTES_${version}.txt`);
  if (!fs.existsSync(notesPath)) return '';
  const text = fs.readFileSync(notesPath, 'utf8');
  const parts = [];
  const summary = extractSection(text, 'Resumen').replace(/\*\*/g, '').replace(/`/g, '');
  const bullets = bulletsToPlain(extractSection(text, 'Nuevo / mejorado'));
  if (summary) parts.push(summary);
  if (bullets) parts.push(bullets);
  return parts.join('\n\n');
}

module.exports = { releaseNotesPlainFromDoc };
