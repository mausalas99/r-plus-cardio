/** @type {import('./unified-patient-grid-board.mjs').UnifiedPatientGridBoard|null} */
let _gridBoard = null;
let _appShellInstalled = false;
let _entregaControlsInstalled = false;
let _guardiaViewBootstrapped = false;
let _elevatedFullWardPullScheduled = false;
let _entregaClickBusy = false;

export function getGridBoard() {
  return _gridBoard;
}

export function setGridBoard(board) {
  _gridBoard = board;
}

export function isAppShellInstalled() {
  return _appShellInstalled;
}

export function markAppShellInstalled() {
  _appShellInstalled = true;
}

export function isEntregaControlsInstalled() {
  return _entregaControlsInstalled;
}

export function markEntregaControlsInstalled() {
  _entregaControlsInstalled = true;
}

export function isGuardiaViewBootstrapped() {
  return _guardiaViewBootstrapped;
}

export function setGuardiaViewBootstrapped(value) {
  _guardiaViewBootstrapped = !!value;
}

export function isElevatedFullWardPullScheduled() {
  return _elevatedFullWardPullScheduled;
}

export function markElevatedFullWardPullScheduled() {
  _elevatedFullWardPullScheduled = true;
}

export function isEntregaClickBusy() {
  return _entregaClickBusy;
}

export function setEntregaClickBusy(value) {
  _entregaClickBusy = !!value;
}
