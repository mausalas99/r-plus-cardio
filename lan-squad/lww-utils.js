'use strict';

const { compareUpdatedAt, pickLwwRecord, recordTimestamp } = require('./lww-utils-core.js');
const { mergeRecordsLww } = require('./lww-utils-merge.js');

module.exports = { compareUpdatedAt, pickLwwRecord, mergeRecordsLww, recordTimestamp };
