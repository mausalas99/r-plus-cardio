import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

const TOUR_FLOW_PARTS = [
  'tour-flow.mjs',
  'tour-flow-guardia-copy.mjs',
  'tour-flow-chapter.mjs',
  'tour-flow-render.mjs',
  'tour-flow-navigation.mjs',
  'tour-flow-lifecycle.mjs',
  'tour-flow-onboarding.mjs',
  'tour-flow-demo-cleanup.mjs',
  'tour-flow-resume.mjs',
];

function readTourFlowSources() {
  return TOUR_FLOW_PARTS.map((name) => readFileSync(join(dir, name), 'utf8')).join('\n');
}

describe('tour intro launch', () => {
  it('loads startOnboarding from tour-flow (avoids circular import)', () => {
    const src = readFileSync(join(dir, 'tour-intro.mjs'), 'utf8');
    assert.match(src, /import\('\.\/tour-flow\.mjs'\)/);
    assert.match(src, /mod\.startOnboarding\(branch\)/);
    assert.doesNotMatch(src, /^\s*startOnboarding\('/m);
  });

  it('prompts Mi rotación after sala tour completion', () => {
    const src = readTourFlowSources();
    assert.match(src, /handlePostGuidedTourOnboardingResume/);
    assert.match(src, /promptMiRotacionAfterSalaTourIfNeeded/);
    assert.match(src, /prepareSalaGuidedTourExitSync/);
    assert.match(src, /hideMainClinicalOnboarding/);
    assert.match(src, /setClinicalSyncModeLocalOnly\(false\)/);
    assert.match(src, /openClinicalTeamsPanel\(\{ skipProfileGate: true \}\)/);
    const roster = readFileSync(
      join(dir, '..', 'clinical-teams', 'teams-roster-shell.mjs'),
      'utf8'
    );
    assert.match(roster, /skipProfileGate/);
    assert.match(src, /nombre completo de tu R2/);
    assert.match(src, /needsTeamOnboarding/);
    const state = readFileSync(join(dir, 'tour-state.mjs'), 'utf8');
    assert.match(state, /handlePostGuidedTourOnboardingResume/);
  });

  it('startOnboarding uses imported applyTourTargetForStep', () => {
    const src = readFileSync(join(dir, 'tour-flow-onboarding.mjs'), 'utf8');
    assert.match(src, /applyTourTargetForStep\(tourState\.tourStepId\)/);
    assert.doesNotMatch(src, /applyTourNavigationForStep/);
  });

  it('applyTourTargetForStep imports demo constants from tour-demo-seed', () => {
    const src = readFileSync(join(dir, 'tour-step-actions.mjs'), 'utf8');
    assert.match(src, /TOUR_STEPS_USE_DEMO_PEREZ/);
    assert.match(src, /from '\.\/tour-demo-seed\.mjs'/);
    assert.doesNotMatch(src, /^\s*var TOUR_STEPS_USE_DEMO_PEREZ/m);
  });

  it('tour-flow imports tour-engine cleanup helpers', () => {
    const lifecycle = readFileSync(join(dir, 'tour-flow-lifecycle.mjs'), 'utf8');
    assert.match(lifecycle, /from '\.\/tour-engine\.mjs'/);
    assert.match(lifecycle, /clearTourSoapButtonHighlight/);
    assert.match(lifecycle, /syncLearnHubContinueVisibility/);
  });

  it('wrap step uses guidedTourFinish and completes on last step', () => {
    const flow = readTourFlowSources();
    assert.match(flow, /export function finishGuidedTour|export \{ finishGuidedTour/);
    assert.match(flow, /guidedTourFinish\(\)/);
    const click = flow.match(/function guidedTourClickNext\(\) \{[\s\S]*?\n\}/);
    assert.ok(click);
    assert.match(
      click[0],
      /if \(tourState\.tourStepId === 'wrap' \|\| tourState\.tourStepId === 'quick_wrap'\)/
    );
    const wrapIdx = click[0].indexOf(
      "if (tourState.tourStepId === 'wrap' || tourState.tourStepId === 'quick_wrap')"
    );
    const idxCheck = click[0].indexOf('if (i < 0) return');
    assert.ok(wrapIdx < idxCheck, 'wrap finish runs before i < 0 bail');
    assert.match(click[0], /if \(i \+ 1 >= steps\.length\) \{\s*finishGuidedTour/);
    const lazy = readFileSync(join(dir, '..', '..', 'lazy-feature-routes-handlers.mjs'), 'utf8');
    assert.match(lazy, /guidedTourFinish: 'finishGuidedTour'/);
    const index = readFileSync(join(dir, 'index.mjs'), 'utf8');
    assert.match(index, /guidedTourFinish:\s*finishGuidedTour/);
    assert.match(index, /finishGuidedTour,/);
  });

  it('tour-demo-seed imports applyTourDemoIngresoDates from tour-demo-dates', () => {
    const seed = readFileSync(join(dir, 'tour-demo-seed.mjs'), 'utf8');
    assert.match(seed, /applyTourDemoIngresoDates/);
    assert.match(seed, /from '\.\.\/\.\.\/tour-demo-dates\.mjs'/);
    assert.doesNotMatch(seed, /function applyTourDemoIngresoDates/);
  });

  it('tour lab registration uses preview Agregar paciente (no auto-modal when preview open)', () => {
    const onboarding = readFileSync(join(dir, 'tour-flow-onboarding.mjs'), 'utf8');
    assert.match(onboarding, /function tourAfterBulkLabParse/);
    assert.match(onboarding, /isBulkLabPreviewModalOpen/);
    assert.match(onboarding, /function tourOnBulkPreviewPatientSaved/);
    assert.match(onboarding, /Agregar paciente en la tabla/);
    const previewBody = onboarding.match(/function tourOnBulkPreviewPatientSaved\(\) \{([\s\S]*?)\n\}/);
    assert.ok(previewBody, 'tourOnBulkPreviewPatientSaved body');
    assert.doesNotMatch(previewBody[1], /scheduleTourDemoPatientRegistrationFromLab/);
    const patients = readFileSync(join(dir, '..', 'patients-modal.mjs'), 'utf8');
    assert.match(patients, /isAddPatientModalOpenForRegistro/);
  });

  it('clinical-onboarding-main calls post-registration education hook', () => {
    const main = readFileSync(
      join(dir, '..', 'clinical-onboarding-main.mjs'),
      'utf8'
    );
    assert.match(main, /tryShowPostRegistrationEducationIfNeeded/);
    assert.doesNotMatch(main, /tryShowGuidedTourIntroIfNeeded/);
  });

  it('guardia-v7 gating requires post-registration', () => {
    const gating = readFileSync(
      join(dir, '..', '..', 'guardia-v7-gating.mjs'),
      'utf8'
    );
    assert.match(gating, /needsOnboarding/);
    assert.match(gating, /shouldOfferGuardiaV7Education/);
  });

  it('learn-hub and upgrade card modules exist', () => {
    const hub = readFileSync(join(dir, 'learn-hub.mjs'), 'utf8');
    assert.match(hub, /openLearnHub/);
    assert.match(hub, /GUARDIA_V7_HUB_MODULES/);
    const card = readFileSync(join(dir, 'guardia-v7-upgrade-card.mjs'), 'utf8');
    assert.match(card, /maybeShowGuardiaV7UpgradeCard/);
    assert.match(card, /dismissGuardiaV7UpgradeCard/);
  });

  it('tourAfterBulkLabParse advances lab_parse when both demo patients are in census', () => {
    const onboarding = readFileSync(join(dir, 'tour-flow-onboarding.mjs'), 'utf8');
    assert.match(onboarding, /function tourAfterBulkLabParse/);
    assert.match(onboarding, /if \(!tourDemoPatientsBothInCensus\(patients\)\)/);
    assert.match(onboarding, /onboardingAdvanceAfterParse\(\)/);
    const labWorkbench = readFileSync(join(dir, '..', 'lab-panel-workbench.mjs'), 'utf8');
    assert.match(labWorkbench, /notifyTourAfterBulkLabStore/);
  });
});
