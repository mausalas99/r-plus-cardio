const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildPublishSteps, createReleaseProgress } = require('./release-progress');

describe('release-progress', () => {
  it('buildPublishSteps omite builds con --skip-build', () => {
    const steps = buildPublishSteps({ skipBuild: true, skipGh: true, skipPush: true });
    assert.ok(!steps.some((s) => s.id === 'build-mac'));
  });

  it('createReleaseProgress llega a 100% al finish', () => {
    const events = [];
    const progress = createReleaseProgress(
      [
        { id: 'a', label: 'A', weight: 1 },
        { id: 'b', label: 'B', weight: 1 },
      ],
      {
        jsonMode: true,
        onEvent(ev) {
          events.push(ev);
        },
      }
    );
    progress.start('a');
    progress.complete('a');
    progress.start('b');
    progress.complete('b');
    progress.finish();
    const done = events.find((e) => e.type === 'done');
    assert.equal(done.pct, 100);
  });
});
