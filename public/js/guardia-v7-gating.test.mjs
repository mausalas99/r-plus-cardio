import test from 'node:test';
import assert from 'node:assert/strict';
import {
  semverLt,
  semverGte,
  shouldOfferGuardiaV7Education,
  shouldShowFundamentosTourIntro,
} from './guardia-v7-gating.mjs';

test('semver helpers', () => {
  assert.equal(semverLt('6.7.0', '7.0.0'), true);
  assert.equal(semverGte('7.0.1', '7.0.0'), true);
});

test('shouldOfferGuardiaV7Education requires post-registration', () => {
  assert.equal(
    shouldOfferGuardiaV7Education({
      prevVersion: '6.7.0', curVersion: '7.0.0', needsOnboarding: true,
    }),
    false
  );
  assert.equal(
    shouldOfferGuardiaV7Education({
      prevVersion: '6.7.0', curVersion: '7.0.0', needsOnboarding: false, trackComplete: false,
    }),
    true
  );
});

test('upgrader skips fundamentals intro on bump', () => {
  assert.equal(
    shouldShowFundamentosTourIntro({
      curVersion: '7.0.1', storedDoneVersion: '6.6.8', needsOnboarding: false,
    }),
    false
  );
  assert.equal(
    shouldShowFundamentosTourIntro({
      curVersion: '7.0.0', storedDoneVersion: '', needsOnboarding: false,
    }),
    true
  );
});
