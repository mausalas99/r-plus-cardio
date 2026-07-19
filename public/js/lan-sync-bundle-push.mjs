/**
 * Cooldown for debounced full-room PUT pushes after bundle conflicts.
 */

/** @type {Record<string, number>} */
var _bundlePushPausedUntil = {};

export function pauseBundlePushForRoom(roomId, ms) {
  var rid = String(roomId || '*').trim() || '*';
  var n = Math.max(1000, Number(ms) || 30000);
  _bundlePushPausedUntil[rid] = Date.now() + n;
  if (rid !== '*') _bundlePushPausedUntil['*'] = Date.now() + n;
}

export function isBundlePushPaused(roomId) {
  var rid = String(roomId || '').trim();
  var until = Math.max(
    Number(_bundlePushPausedUntil[rid] || 0),
    Number(_bundlePushPausedUntil['*'] || 0)
  );
  return Date.now() < until;
}

export function bundleConflictsAreClinicalOpsOnly(conflicts) {
  if (!conflicts || !conflicts.length) return true;
  return conflicts.every(function (c) {
    if (!c) return true;
    var k = String(c.key || c.kind || '').trim();
    return k === 'clinicalOps' || k === 'revision' || k === '*' || k === '';
  });
}
