/** Late-bound refs to avoid circular imports between lab-panel modules. */
export const labPanelBridge = {
  getActiveLab() { return null; },
  setActiveLab(_next) {},
  renderOutput(_result, _opts) {},
  syncLabOutputChrome() {},
  renderLabHistoryPanel() {},
};
