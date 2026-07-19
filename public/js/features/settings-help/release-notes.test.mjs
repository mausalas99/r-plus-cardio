import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCuratedReleaseNotesPlain,
  formatUpdaterReleaseNotesPlain,
} from './release-notes.mjs';
import {
  RELEASE_NOTES_HIGHLIGHTS,
  RELEASE_NOTES_HIGHLIGHTS_DEFAULT,
} from './release-notes-curated.mjs';

describe('release-notes', () => {
  it('resolves curated highlights for v-prefixed version', () => {
    const text = formatCuratedReleaseNotesPlain('v7.1.8');
    assert.ok(text.includes('Conectar al anfitrión'));
    assert.ok(!text.includes('Signos vitales'));
  });

  it('does not fall back to default for unknown future version', () => {
    assert.equal(formatCuratedReleaseNotesPlain('99.0.0'), '');
  });

  it('uses default when version omitted', () => {
    const versionKey = Object.entries(RELEASE_NOTES_HIGHLIGHTS).find(
      ([, notes]) => notes === RELEASE_NOTES_HIGHLIGHTS_DEFAULT
    )?.[0];
    assert.ok(
      versionKey,
      'RELEASE_NOTES_HIGHLIGHTS_DEFAULT must be registered in RELEASE_NOTES_HIGHLIGHTS'
    );

    const text = formatCuratedReleaseNotesPlain('');
    assert.ok(text.length > 0, 'default release notes must not be empty');
    assert.ok(!text.includes('Completar antes de publicar'));
    assert.ok(
      !RELEASE_NOTES_HIGHLIGHTS_DEFAULT.some((n) => String(n.title || '').trim() === 'TODO'),
      'default highlights must not use TODO placeholders'
    );
    assert.equal(text, formatCuratedReleaseNotesPlain(versionKey));
  });

  it('updater prefers curated target version over stale feed notes', () => {
    const text = formatUpdaterReleaseNotesPlain('7.1.8', 'Signos vitales sin falsas alarmas');
    assert.ok(text.includes('Conectar al anfitrión'));
    assert.ok(!text.includes('Signos vitales'));
  });

  it('updater uses feed notes when no curated entry exists', () => {
    const feed = 'Cableado LAN transport — fix esbuild chunks.';
    const text = formatUpdaterReleaseNotesPlain('99.0.0', feed);
    assert.equal(text, feed);
  });
});
