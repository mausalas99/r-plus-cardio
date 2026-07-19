'use strict';

const { ConflictError } = require('./conflict-resolver-utils.js');
const { applyMutation } = require('./conflict-resolver-apply.js');

function createConflictResolver({ store }) {
  return {
    applyMutation: (mutation, opts) => applyMutation(store, mutation, opts),
    ConflictError,
    store,
  };
}

module.exports = { createConflictResolver, ConflictError };
