import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUi, collectDuplicateIds } from './build-ui.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, 'fixtures', 'build-ui');

describe('build-ui', () => {
  it('resolves @include recursively', () => {
    const out = buildUi(path.join(fixtureRoot, 'index.src.html'));
    assert.match(out, /HEADER/);
    assert.match(out, /BODY/);
    assert.match(out, /FOOTER/);
  });

  it('fails on missing include', () => {
    assert.throws(
      () => buildUi(path.join(fixtureRoot, 'broken.src.html')),
      /include not found/i
    );
  });

  it('detects duplicate ids', () => {
    const dupes = collectDuplicateIds('<motion id="a"></div><div id="a"></motion>');
    assert.deepStrictEqual(dupes, ['a']);
  });
});
