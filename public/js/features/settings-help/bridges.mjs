/** Breaks tour ↔ help circular imports; wired from index.mjs after load. */
export const settingsHelpBridge = {
  closeReleaseNotes() {},
  closeQuickHelp() {},
  syncLearnHubContinueVisibility() {},
};
