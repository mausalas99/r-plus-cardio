const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { applyBuildLogLine, resetBuildLogState } = require('./release-build-log');
const { createReleaseProgress } = require('./release-progress');

function mockProgress() {
  const subs = [];
  return {
    subs,
    subProgress(id, pct, detail) {
      subs.push({ id, pct, detail });
    },
  };
}

describe('release-build-log', () => {
  beforeEach(() => resetBuildLogState());

  it('avanza sub-progreso Mac con líneas de electron-builder', () => {
    const p = mockProgress();
    applyBuildLogLine(p, 'build-mac', '• packaging       platform=darwin arch=arm64');
    applyBuildLogLine(p, 'build-mac', '• building        target=DMG arch=arm64');
    assert.ok(p.subs.length >= 2);
    assert.ok(p.subs[p.subs.length - 1].pct > p.subs[0].pct);
  });

  it('avanza sub-progreso tests con ok lines', () => {
    const p = mockProgress();
    applyBuildLogLine(p, 'tests', 'ok 1 - ejemplo');
    applyBuildLogLine(p, 'tests', 'ok 42 - otro');
    assert.ok(p.subs.length >= 2);
    assert.ok(p.subs[1].pct >= p.subs[0].pct);
  });
});
