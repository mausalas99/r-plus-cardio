/** Shared runtime hooks and modal state for Drive import. */

let rt = {
  getActiveId() {
    return null;
  },
  getActivePatient() {
    return null;
  },
  showToast(_msg, _type) {},
  pushUndoSnapshot(_label) {},
  switchInnerTab(_tab) {},
  switchAppTab(_tab) {},
  addAuditEntry(_action, _result, _count, _detail) {},
};

export const driveImportState = {
  debounceId: null,
  autoReviewPending: false,
  importBusy: false,
  /** @type {'paste' | 'review'} */
  modalStep: 'paste',
  /** @type {import('../../../../lib/drive-import/drive-import-review.mjs').DriveImportReviewStep[]} */
  reviewSteps: [],
  reviewIndex: 0,
};

export function registerDriveImportRuntime(ctx) {
  if (ctx && typeof ctx === 'object') Object.assign(rt, ctx);
}

export function getDriveImportRuntime() {
  return rt;
}

export function resetDriveImportSession() {
  driveImportState.reviewSteps = [];
  driveImportState.reviewIndex = 0;
  driveImportState.autoReviewPending = false;
  driveImportState.importBusy = false;
}
