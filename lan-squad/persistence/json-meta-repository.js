'use strict';
const path = require('node:path');
const { readJson, writeJsonAtomic } = require('../atomic-json.js');

function metaPath(hostStateDir) {
  return path.join(hostStateDir, 'meta.json');
}

async function readMeta(hostStateDir) {
  return readJson(metaPath(hostStateDir));
}

async function writeMeta(hostStateDir, meta) {
  await writeJsonAtomic(metaPath(hostStateDir), meta);
}

function defaultMeta(teamCodeHash) {
  return {
    version: 2,
    teamCodeHash,
    patients: [],
    rooms: [],
    roomRevisions: {},
  };
}

module.exports = { readMeta, writeMeta, defaultMeta, metaPath };
