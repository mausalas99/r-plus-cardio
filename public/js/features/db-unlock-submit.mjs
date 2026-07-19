import { unlockErrorMessage } from './db-unlock-errors.mjs';
import {
  needsPassphraseConfirm,
  collectClinicalLsSnapshot,
  clearMigratedLocalStorageKeys,
  runMigrationProbe,
} from './db-unlock-migration.mjs';
import {
  configureUnlockForm,
  finishUnlockFlow,
  setUnlockError,
} from './db-unlock-overlay.mjs';
import { dbUnlockState, electronApi } from './db-unlock-state.mjs';

function getRecoveryModeElements() {
  return {
    recoveryWrap: document.getElementById('rpc-db-unlock-recovery-wrap'),
    toggleBtn: document.getElementById('rpc-db-unlock-recovery-toggle'),
    passEl: document.getElementById('rpc-db-unlock-pass'),
    confirmWrap: document.getElementById('rpc-db-unlock-confirm-wrap'),
    rememberLabel: document.querySelector('.rpc-db-unlock-remember'),
    rememberHint: document.querySelector('.settings-acc-hint--tight'),
    submitBtn: document.getElementById('rpc-db-unlock-submit'),
  };
}

function showPassphraseUnlockMode(els) {
  var needsConfirm = dbUnlockState.lastNeedsConfirm;
  if (els.recoveryWrap) els.recoveryWrap.style.display = 'none';
  if (els.toggleBtn) els.toggleBtn.style.display = '';
  if (els.passEl) {
    els.passEl.style.display = '';
    els.passEl.parentElement.style.display = '';
  }
  if (els.confirmWrap) els.confirmWrap.style.display = needsConfirm ? '' : 'none';
  if (els.rememberLabel) els.rememberLabel.style.display = needsConfirm ? '' : '';
  if (els.rememberHint) els.rememberHint.style.display = needsConfirm ? '' : '';
  if (els.submitBtn) {
    els.submitBtn.textContent = needsConfirm ? 'Crear contraseña y continuar' : 'Desbloquear';
    els.submitBtn.setAttribute('onclick', 'submitDbUnlockPassphrase()');
  }
}

function showRecoveryUnlockMode(els) {
  if (els.recoveryWrap) els.recoveryWrap.style.display = '';
  if (els.toggleBtn) els.toggleBtn.style.display = 'none';
  if (els.passEl) {
    els.passEl.style.display = 'none';
    els.passEl.parentElement.style.display = 'none';
  }
  if (els.confirmWrap) els.confirmWrap.style.display = 'none';
  if (els.rememberLabel) els.rememberLabel.style.display = 'none';
  if (els.rememberHint) els.rememberHint.style.display = 'none';
  if (els.submitBtn) {
    els.submitBtn.textContent = 'Recuperar acceso';
    els.submitBtn.setAttribute('onclick', 'submitRecoveryCode()');
  }
  var recCode = document.getElementById('rpc-db-unlock-recovery-code');
  if (recCode) recCode.focus();
}

export function toggleRecoveryMode() {
  var els = getRecoveryModeElements();
  var isRecovery = els.recoveryWrap && els.recoveryWrap.style.display !== 'none';
  if (isRecovery) showPassphraseUnlockMode(els);
  else showRecoveryUnlockMode(els);
  setUnlockError('');
}

async function refreshUnlockFormFromStatus(electron) {
  try {
    var st2 = await electron.dbStatus();
    configureUnlockForm(st2, dbUnlockState.lastMigrationProbe);
  } catch {
    /* status refresh optional after failed submit */
  }
}

function validatePassphraseSubmit(passphrase, confirm, isSetup) {
  if (isSetup) {
    if (passphrase.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!confirm) return 'Confirma la contraseña en el segundo campo.';
    if (passphrase !== confirm) return 'La confirmación no coincide con la contraseña.';
    return '';
  }
  if (!passphrase) return 'Ingresa la contraseña maestra.';
  return '';
}

async function resolveUnlockProbe(electron) {
  var probe = dbUnlockState.lastMigrationProbe;
  if (probe) return probe;
  probe = await runMigrationProbe(electron);
  dbUnlockState.lastMigrationProbe = probe;
  return probe;
}

async function readUnlockDbStatus(electron) {
  try {
    return await electron.dbStatus();
  } catch {
    return { migrationPending: false, dbFileExists: true };
  }
}

function buildUnlockPayload(passphrase, remember, isSetup, probe) {
  var unlockPayload = { passphrase: passphrase, remember: remember, setup: isSetup };
  if (probe && probe.needed) {
    unlockPayload.lsSnapshot = collectClinicalLsSnapshot();
  }
  return unlockPayload;
}

function handleUnlockMigrationWarning(res, submitBtn) {
  if (!res.migrationWarning) return true;
  var warnMsg =
    'La base cifrada se creó, pero la migración de datos locales falló: ' + res.migrationWarning;
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(warnMsg, 'error');
    return true;
  }
  setUnlockError(warnMsg);
  if (submitBtn) submitBtn.disabled = false;
  return false;
}

export async function submitRecoveryCode() {
  var electron = electronApi();
  if (!electron || typeof electron.dbUnlockRecovery !== 'function') return;

  var codeEl = document.getElementById('rpc-db-unlock-recovery-code');
  var code = codeEl ? String(codeEl.value || '').trim() : '';

  if (!code) {
    setUnlockError('Ingresa el código de recuperación.');
    return;
  }

  setUnlockError('');
  var submitBtn = document.getElementById('rpc-db-unlock-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    var res = await electron.dbUnlockRecovery({ code: code });
    if (!res || res.ok === false) {
      setUnlockError(unlockErrorMessage(res || {}, {}));
      if (submitBtn) submitBtn.disabled = false;
      await refreshUnlockFormFromStatus(electron);
      return;
    }
    finishUnlockFlow({ unlocked: true, status: res, recoveryCodeToShow: res.recoveryCodeToShow });
  } catch (err) {
    setUnlockError((err && err.message) || 'Error al recuperar.');
    if (submitBtn) submitBtn.disabled = false;
  }
}

function readUnlockPassphraseForm() {
  var passEl = document.getElementById('rpc-db-unlock-pass');
  var confirmEl = document.getElementById('rpc-db-unlock-confirm');
  var rememberEl = document.getElementById('rpc-db-unlock-remember');
  return {
    passphrase: passEl ? String(passEl.value || '') : '',
    confirm: confirmEl ? String(confirmEl.value || '') : '',
    remember: !!(rememberEl && rememberEl.checked),
  };
}

async function handleUnlockSubmitFailure(electron, res, isSetup, status, submitBtn) {
  setUnlockError(unlockErrorMessage(res || {}, { setup: isSetup }));
  if (submitBtn) submitBtn.disabled = !!(status && status.rateLimited);
  await refreshUnlockFormFromStatus(electron);
}

function finalizeUnlockSubmitSuccess(res, submitBtn) {
  if (res.clearKeys && res.clearKeys.length) {
    clearMigratedLocalStorageKeys(res.clearKeys);
  }
  if (!handleUnlockMigrationWarning(res, submitBtn)) return false;
  dbUnlockState.lastMigrationProbe = { needed: false, hasHostJson: false };
  finishUnlockFlow({ unlocked: true, status: res, recoveryCodeToShow: res.recoveryCodeToShow });
  return true;
}

export async function submitDbUnlockPassphrase() {
  var electron = electronApi();
  if (!electron || typeof electron.dbUnlock !== 'function') return;

  var form = readUnlockPassphraseForm();
  var status = await readUnlockDbStatus(electron);
  var probe = await resolveUnlockProbe(electron);
  var isSetup = needsPassphraseConfirm(status, probe);
  var validationError = validatePassphraseSubmit(form.passphrase, form.confirm, isSetup);
  if (validationError) {
    setUnlockError(validationError);
    return;
  }

  setUnlockError('');
  var submitBtn = document.getElementById('rpc-db-unlock-submit');
  if (submitBtn) submitBtn.disabled = true;

  try {
    var res = await electron.dbUnlock(
      buildUnlockPayload(form.passphrase, form.remember, isSetup, probe)
    );
    if (!res || res.ok === false) {
      await handleUnlockSubmitFailure(electron, res, isSetup, status, submitBtn);
      return;
    }
    finalizeUnlockSubmitSuccess(res, submitBtn);
  } catch (err) {
    setUnlockError((err && err.message) || 'Error al desbloquear.');
    if (submitBtn) submitBtn.disabled = false;
  }
}
