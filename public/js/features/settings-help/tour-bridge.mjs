/** Breaks tour-engine ↔ tour-mini circular imports. */
export const tourBridge = {
  miniTourNext() {},
  endMiniTour() {},
};
