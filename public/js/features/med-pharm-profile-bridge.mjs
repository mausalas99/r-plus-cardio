/** Late-bound render/modal refs to avoid grid ↔ render ↔ modals cycles. */
export const medPharmProfileBridge = {
  renderMedPharmProfilePanel() {},
  openMedPharmFullModal() {},
  openMedPharmMedGroupModal(_medGroupKey) {},
  openMedPharmPasteModal() {},
  importMedPharmMonthPaste() {},
};
