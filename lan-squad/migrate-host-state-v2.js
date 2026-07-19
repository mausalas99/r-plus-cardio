'use strict';

function normalizeVersionedRecords(items) {
  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    if (item && typeof item === 'object') {
      if (item.version == null) item.version = 1;
      if (!Array.isArray(item.audit_log)) item.audit_log = [];
    }
  }
  return list;
}

function migrateRoomSyncBundles(bundles, migrateBundleFn) {
  const source = bundles && typeof bundles === 'object' ? bundles : {};
  const next = {};
  for (const rid of Object.keys(source)) {
    next[rid] = migrateBundleFn(source[rid]);
  }
  return next;
}

module.exports = { normalizeVersionedRecords, migrateRoomSyncBundles };
