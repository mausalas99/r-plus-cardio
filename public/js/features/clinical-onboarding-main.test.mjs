import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLINICAL_ONBOARDING_MAIN_ID,
  CLINICAL_ONBOARDING_ACTIVE_CLASS,
  describeOnboardingSessionBlock,
} from './clinical-onboarding-main.mjs';

describe('clinical-onboarding-main', () => {
  it('exports stable host id', () => {
    assert.equal(CLINICAL_ONBOARDING_MAIN_ID, 'clinical-onboarding-main');
    assert.equal(CLINICAL_ONBOARDING_ACTIVE_CLASS, 'clinical-onboarding-active');
  });

  it('describeOnboardingSessionBlock mentions local DB not LAN', async () => {
    const msg = await describeOnboardingSessionBlock();
    assert.match(msg, /base de datos local|base local/i);
    assert.match(msg, /no necesitas red LAN|No necesitas red LAN/i);
  });
});
