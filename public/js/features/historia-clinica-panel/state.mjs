/** @type {Set<string>} */
const dirtyKeys = new Set();

export const hcState = {
  version: 0,
  data: null,
  editMode: false,
  step: 1,
  pendingAck: [],
};

export function getDirtyKeys() {
  return dirtyKeys;
}

export function resetDirtyKeys() {
  dirtyKeys.clear();
}

export function replaceDirtyKeys(next) {
  dirtyKeys.clear();
  if (next && typeof next.forEach === 'function') {
    next.forEach(function (k) {
      dirtyKeys.add(k);
    });
  }
}

export function invalidateHistoriaClinicaPanel() {
  hcState.data = null;
  hcState.version = 0;
  hcState.editMode = false;
  hcState.step = 1;
  hcState.pendingAck = [];
  dirtyKeys.clear();
}
