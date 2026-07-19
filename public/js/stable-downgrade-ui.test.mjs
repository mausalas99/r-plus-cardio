import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDefaultDowngradeVersion,
  isBlockedByMinVersion,
  resolveDowngradeEntries,
  filterEntriesWithGitHubReleases,
} from './stable-downgrade-ui.mjs';

test('pickDefaultDowngradeVersion elige recommended', () => {
  const v = pickDefaultDowngradeVersion([
    { version: '6.5.3', recommended: true },
    { version: '6.5.2' },
  ]);
  assert.equal(v, '6.5.3');
});

test('pickDefaultDowngradeVersion cae al primero', () => {
  assert.equal(
    pickDefaultDowngradeVersion([{ version: '6.5.2' }, { version: '6.5.1' }]),
    '6.5.2'
  );
});

test('isBlockedByMinVersion respeta minVersion remoto', () => {
  assert.equal(isBlockedByMinVersion('6.5.2', '6.5.3'), true);
  assert.equal(isBlockedByMinVersion('6.5.3', '6.5.3'), false);
  assert.equal(isBlockedByMinVersion('6.5.4', '6.5.3'), false);
});

test('resolveDowngradeEntries excluye versión actual', () => {
  const raw = {
    entries: [
      { version: '6.5.4', label: '6.5.4' },
      { version: '6.5.3', label: '6.5.3', recommended: true },
    ],
  };
  const { entries } = resolveDowngradeEntries(raw, '6.5.4', 'remote');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].version, '6.5.3');
});

test('filterEntriesWithGitHubReleases oculta tags borrados en GitHub', () => {
  const entries = [
    { version: '6.5.3', label: '6.5.3' },
    { version: '6.5.0', label: '6.5.0', recommended: true },
    { version: '6.4.2', label: '6.4.2' },
  ];
  const out = filterEntriesWithGitHubReleases(entries, ['v6.5.0', 'v6.4.2', 'v6.3.6']);
  assert.deepEqual(
    out.map((e) => e.version),
    ['6.5.0', '6.4.2']
  );
});
