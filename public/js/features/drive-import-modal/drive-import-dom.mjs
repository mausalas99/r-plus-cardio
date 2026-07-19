/** DOM accessors for the Drive import modal. */

export function getBackdrop() {
  return document.getElementById('drive-import-backdrop');
}

export function getTextarea() {
  return /** @type {HTMLTextAreaElement | null} */ (document.getElementById('drive-import-input'));
}

export function getParseHintEl() {
  return document.getElementById('drive-import-parse-hint');
}

export function getModalEl() {
  return document.querySelector('.drive-import-modal');
}

export function getWarningEl() {
  return document.getElementById('drive-import-warning');
}

export function getApplyMode() {
  const checked = document.querySelector('input[name="drive-import-mode"]:checked');
  const v = checked ? String(checked.value) : 'fill';
  if (v === 'replace' || v === 'eventos') return v;
  return 'fill';
}
