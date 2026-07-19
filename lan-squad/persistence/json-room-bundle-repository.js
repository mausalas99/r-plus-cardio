'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');
const { readJson, writeJsonAtomic } = require('../atomic-json.js');

function bundlePath(hostStateDir, roomId) {
  return path.join(hostStateDir, 'bundles', `${roomId}.json`);
}

async function readRoomBundle(hostStateDir, roomId) {
  return readJson(bundlePath(hostStateDir, roomId));
}

async function writeRoomBundle(hostStateDir, roomId, bundle) {
  const fp = bundlePath(hostStateDir, roomId);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await writeJsonAtomic(fp, bundle);
}

module.exports = { readRoomBundle, writeRoomBundle, bundlePath };
