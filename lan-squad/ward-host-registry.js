'use strict';

const {
  DEFAULT_PORT,
  normalizeHostUrl,
  createRegistryStorage,
  buildHintsForExchange,
  seedFromCandidateBaseUrl,
} = require('./ward-host-registry-store.js');

/**
 * @param {{ filePath?: string }} opts
 */
function createWardHostRegistry(opts = {}) {
  const filePath = opts.filePath ? String(opts.filePath) : '';
  const storage = createRegistryStorage(filePath);

  return {
    load: storage.load,
    save: storage.save,
    recordUrl: storage.recordUrl,
    recordPrefix: storage.recordPrefix,
    merge: storage.merge,
    prune: storage.prune,
    clear: storage.clear,
    getHintsForExchange: (maxAgeMs) => buildHintsForExchange(storage.load, maxAgeMs),
    seedFromCandidateBaseUrl: (candidateBaseUrl) =>
      seedFromCandidateBaseUrl(storage, candidateBaseUrl),
    normalizeHostUrl,
    DEFAULT_PORT,
  };
}

module.exports = { createWardHostRegistry, normalizeHostUrl };
