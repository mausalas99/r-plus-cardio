'use strict';

/**
 * Host-side domain merge helpers (IM-12). Renderer uses public/js/lan-merge-registry.mjs.
 */
const { mergeClinicalOpsSnapshotsData } = require('../lib/db/clinical-ops-bundle-merge.cjs');

module.exports = {
  mergeClinicalOpsSnapshotsData,
};
