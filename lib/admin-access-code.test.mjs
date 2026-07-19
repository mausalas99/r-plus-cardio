import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdminAccessCode } from './admin-access-code.mjs';

describe('admin-access-code', () => {
  it('accepts the configured code', () => {
    assert.equal(verifyAdminAccessCode('Msg170699'), true);
    assert.equal(verifyAdminAccessCode('  Msg170699  '), true);
  });

  it('rejects wrong or empty input', () => {
    assert.equal(verifyAdminAccessCode('wrong'), false);
    assert.equal(verifyAdminAccessCode(''), false);
    assert.equal(verifyAdminAccessCode(null), false);
  });
});
