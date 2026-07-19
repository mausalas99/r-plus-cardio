/**
 * Emergency recovery — paste in Safari Web Inspector console on iPad R+ Móvil
 * (Develop → [iPad] → the R+ tab) BEFORE clearing site data.
 *
 * Exports monitoreo found in rpc-lan-sync-outbox / rpc-lan-room-snapshots as JSON
 * and merges into rpc-patients when possible.
 */
(function recoverIpadVitalsFromLanCache() {
  var roomId = 'sala-2'; // change if your sala differs
  function parseJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function histCount(m) {
    return m && Array.isArray(m.historial) ? m.historial.length : 0;
  }
  var bestById = {};
  function remember(p) {
    if (!p || !p.id || !p.monitoreo) return;
    if (histCount(p.monitoreo) === 0) return;
    var id = String(p.id);
    if (!bestById[id] || histCount(p.monitoreo) > histCount(bestById[id].monitoreo)) {
      bestById[id] = JSON.parse(JSON.stringify(p));
    }
  }
  var outbox = parseJson('rpc-lan-sync-outbox', {});
  (outbox[roomId] || []).forEach(function (item) {
    var entries = item && item.payload && item.payload.entries;
    if (!Array.isArray(entries)) return;
    entries.forEach(function (e) {
      if (e && e.patient) remember(e.patient);
    });
  });
  var snaps = parseJson('rpc-lan-room-snapshots', {});
  var snap = snaps[roomId];
  if (snap && Array.isArray(snap.entries)) {
    snap.entries.forEach(function (e) {
      if (e && e.patient) remember(e.patient);
    });
  }
  var ids = Object.keys(bestById);
  if (!ids.length) {
    console.warn('[recover] No monitoreo in LAN cache. Try rpc-undo-stack or iPad backup.');
    return { ok: false, ids: [] };
  }
  var patients = parseJson('rpc-patients', []);
  if (!Array.isArray(patients)) patients = [];
  var restored = 0;
  ids.forEach(function (id) {
    var cached = bestById[id];
    var row =
      patients.find(function (p) {
        return p && String(p.id) === id;
      }) || null;
    if (!row) {
      patients.unshift(cached);
      restored += 1;
      return;
    }
    row.monitoreo = row.monitoreo || cached.monitoreo;
    if (histCount(cached.monitoreo) > histCount(row.monitoreo)) {
      row.monitoreo = cached.monitoreo;
      restored += 1;
    }
  });
  localStorage.setItem('rpc-patients', JSON.stringify(patients));
  console.log('[recover] patients touched:', restored, 'cache ids:', ids);
  return { ok: true, restored: restored, ids: ids, export: bestById };
})();
