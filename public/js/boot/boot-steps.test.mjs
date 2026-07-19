import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBootSteps } from './boot-steps.mjs';

test('runBootSteps rethrows and logs step id on failure', async () => {
  const logs = [];
  const origError = console.error;
  console.error = function (...args) {
    logs.push(args);
  };
  try {
    await assert.rejects(
      () =>
        runBootSteps(
          [
            { id: 'ok', async run() {} },
            {
              id: 'bad-step',
              async run() {
                throw new Error('boom');
              },
            },
          ],
          {}
        ),
      /boom/
    );
    assert.ok(logs.some((row) => row[0] === '[boot]' && row[1] === 'bad-step'));
  } finally {
    console.error = origError;
  }
});
