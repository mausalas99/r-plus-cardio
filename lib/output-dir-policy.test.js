'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  writeApprovedOutputDir,
  resolveAllowedOutputDir,
} = require('./output-dir-policy.js');

describe('output-dir-policy', () => {
  it('resolveAllowedOutputDir uses approved path from userData', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-out-'));
    const approved = path.join(tmp, 'approved');
    const downloads = path.join(tmp, 'downloads');
    fs.mkdirSync(approved, { recursive: true });
    fs.mkdirSync(downloads, { recursive: true });
    writeApprovedOutputDir(tmp, approved);

    const resolved = resolveAllowedOutputDir('', {
      userDataPath: tmp,
      downloadsPath: downloads,
    });
    assert.equal(resolved, fs.realpathSync(approved));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('resolveAllowedOutputDir rejects paths outside allow list', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rplus-out-'));
    const downloads = path.join(tmp, 'downloads');
    fs.mkdirSync(downloads, { recursive: true });
    assert.throws(
      () =>
        resolveAllowedOutputDir('/tmp', {
          userDataPath: tmp,
          downloadsPath: downloads,
        }),
      (err) => err.code === 'OUTPUT_DIR_NOT_ALLOWED'
    );
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
