import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import { buildUi, collectDuplicateIds, syncMinVersionPolicy } from './build-ui.mjs';

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

  it('syncMinVersionPolicy copies root policy into public/', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-ui-minver-'));
    try {
      fs.mkdirSync(path.join(tmp, 'public'));
      const policy = '{\n  "minVersion": "1.0.0",\n  "message": "test"\n}\n';
      fs.writeFileSync(path.join(tmp, 'min-version.json'), policy);
      fs.writeFileSync(path.join(tmp, 'public', 'min-version.json'), '{"minVersion":"9.9.9"}\n');
      assert.throws(() => syncMinVersionPolicy(tmp, { check: true }), /out of date/i);
      const result = syncMinVersionPolicy(tmp);
      assert.equal(result.changed, true);
      assert.equal(fs.readFileSync(path.join(tmp, 'public', 'min-version.json'), 'utf8'), policy);
      assert.deepEqual(syncMinVersionPolicy(tmp, { check: true }), { changed: false });
      assert.equal(syncMinVersionPolicy(tmp).changed, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
