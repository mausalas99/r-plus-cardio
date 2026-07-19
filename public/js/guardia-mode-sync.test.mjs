import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { clinicalSessionContext } from './clinical-access-runtime.mjs';
import { setGuardiaMode, syncGuardiaModeUI, toggleGuardiaMode } from './guardia-mode-sync.mjs';

describe('guardia-mode-sync', () => {
  beforeEach(() => {
    if (typeof document === 'undefined') return;
    clinicalSessionContext.guardiaMode = false;
    document.body.innerHTML =
      '<button type="button" id="btn-guardia-mode-toggle">' +
      '<span class="guardia-mode-label"></span></button>';
  });

  it('setGuardiaMode updates clinicalSessionContext', () => {
    setGuardiaMode(true);
    assert.equal(clinicalSessionContext.guardiaMode, true);
    setGuardiaMode(false);
    assert.equal(clinicalSessionContext.guardiaMode, false);
  });

  it('setGuardiaMode updates guardia board toggle', () => {
    if (typeof document === 'undefined') return;
    setGuardiaMode(true);
    assert.equal(clinicalSessionContext.guardiaMode, true);
    const boardBtn = document.getElementById('btn-guardia-mode-toggle');
    assert.equal(boardBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(boardBtn.querySelector('.guardia-mode-label').textContent, 'Solo mis entregas');
  });

  it('toggleGuardiaMode flips state', () => {
    if (typeof document === 'undefined') return;
    toggleGuardiaMode();
    assert.equal(clinicalSessionContext.guardiaMode, true);
    toggleGuardiaMode();
    assert.equal(clinicalSessionContext.guardiaMode, false);
  });

  it('syncGuardiaModeUI reflects session without changing it', () => {
    if (typeof document === 'undefined') return;
    clinicalSessionContext.guardiaMode = true;
    syncGuardiaModeUI();
    assert.equal(document.getElementById('btn-guardia-mode-toggle').getAttribute('aria-pressed'), 'true');
  });
});
