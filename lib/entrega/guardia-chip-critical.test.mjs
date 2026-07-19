import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isGuardiaChipCritical } from './guardia-chip-critical.mjs';

describe('isGuardiaChipCritical', () => {
  it('is false without guardia row', () => {
    assert.equal(isGuardiaChipCritical(undefined), false);
  });

  it('follows is_critical on guardia row', () => {
    assert.equal(isGuardiaChipCritical({ is_critical: 1 }), true);
    assert.equal(isGuardiaChipCritical({ is_critical: 0 }), false);
  });

  it('follows vasopressor / ventilation in handoff context', () => {
    const json = JSON.stringify({
      version: 2,
      items: [],
      handoffContext: { vasopressor: { active: true } },
    });
    assert.equal(isGuardiaChipCritical({ pendientes_json: json }), true);
  });

  it('ignores patient monitoreo (no guardia fields)', () => {
    assert.equal(
      isGuardiaChipCritical({ pendientes_json: '{"version":2,"vitalsPlan":{"frequency":{"mode":"routine"}}}' }),
      false
    );
  });
});
