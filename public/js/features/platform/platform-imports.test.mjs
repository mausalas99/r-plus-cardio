import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { platformWindowHandlers } from '../platform.mjs';
import { compareSemver } from '../platform.mjs';
import { safeExportSlug } from '../platform.mjs';

describe('platform barrel (BN-06)', () => {
  it('exports platformWindowHandlers with backup/update/audit actions', () => {
    assert.equal(typeof platformWindowHandlers, 'object');
    assert.equal(typeof platformWindowHandlers.exportDataBackup, 'function');
    assert.equal(typeof platformWindowHandlers.wipeCacheConfirmed, 'function');
    assert.equal(typeof platformWindowHandlers.checkForAppUpdates, 'function');
    assert.equal(typeof platformWindowHandlers.exportAuditLog, 'function');
  });

  it('compareSemver orders semantic versions', () => {
    assert.ok(compareSemver('6.6.2', '6.6.1') > 0);
    assert.ok(compareSemver('6.6.0', '6.6.1') < 0);
    assert.equal(compareSemver('6.6.1', '6.6.1'), 0);
  });

  it('safeExportSlug sanitizes patient names for filenames', () => {
    assert.equal(safeExportSlug('Juan Pérez #1'), 'Juan_Pérez_1');
    assert.ok(safeExportSlug('').length > 0);
  });
});
