'use strict';
const { collectKeysFromBundlePayload } = require('./entity-keys.js');
const { normalizeVersionedRecords, migrateRoomSyncBundles } = require('./migrate-host-state-v2.js');
const { buildMigratedBundleV2 } = require('./migrate-host-state-bundle.js');

function buildEntityVersionsFromBundle(bundle) {
  const versions = {};
  const keys = collectKeysFromBundlePayload(bundle);
  for (const k of keys) versions[k] = 1;
  return versions;
}

function migrateBundleV1ToV2(bundle) {
  if (!bundle || typeof bundle !== 'object') return bundle;
  return buildMigratedBundleV2(bundle, buildEntityVersionsFromBundle);
}

function migrateHostStateIfNeeded(state) {
  if (!state || typeof state !== 'object') return state;
  if (Number(state.version) === 2) return state;
  const next = { ...state, version: 2 };
  next.patients = normalizeVersionedRecords(state.patients);
  next.rooms = normalizeVersionedRecords(state.rooms);
  next.roomSyncBundles = migrateRoomSyncBundles(state.roomSyncBundles, migrateBundleV1ToV2);
  delete next.calendarEvents;
  return next;
}

module.exports = { migrateHostStateIfNeeded, migrateBundleV1ToV2, buildEntityVersionsFromBundle };
