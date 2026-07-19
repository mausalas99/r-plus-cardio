'use strict';

function createHostStateCache() {
  /** @type {object | null} */
  let state = null;
  return {
    get() {
      if (!state) throw new Error('cache not loaded');
      return state;
    },
    replace(next) {
      state = next;
      return state;
    },
    isLoaded() {
      return state != null;
    },
  };
}

module.exports = { createHostStateCache };
