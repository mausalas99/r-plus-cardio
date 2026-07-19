/**
 * LAN known-room sessions + disconnect banner prefs — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { activeLiveSyncRoomId } from './runtime.mjs';

const LAN_KNOWN_ROOMS_LS = 'rpc-lan-known-rooms';
const LAN_DISCONNECT_BANNER_MSG =
  'Sin conexión al host LAN. LiveSync (salas y relay) puede estar limitado hasta reconectar.';

var _lanLastConnected = true;
var _lanClientChromeWired = false;

function writeLanKnownRooms(arr) {
  try {
    localStorage.setItem(LAN_KNOWN_ROOMS_LS, JSON.stringify(arr.slice(0, 12)));
  } catch (_e) { void _e; }
}

function migrateLanLastRoomToKnown() {
  var list = readLanKnownRooms();
  if (list.length) return;
  var last = '';
  try {
    last = String(localStorage.getItem('rpc-lan-last-room') || '').trim();
  } catch (_e) { void _e; }
  if (last) writeLanKnownRooms([{ id: last, label: 'Última sala', joinedAt: Date.now() }]);
}

function readLanHideDisconnectBanner() {
  return typeof storage.getLanHideDisconnectBanner === 'function' && storage.getLanHideDisconnectBanner();
}

function readLanLwwOverwriteToast() {
  return typeof storage.getLanLwwOverwriteToast === 'function' && storage.getLanLwwOverwriteToast();
}

export function readLanKnownRooms() {
  try {
    var raw = localStorage.getItem(LAN_KNOWN_ROOMS_LS);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(function (x) { return x && x.id; }) : [];
  } catch {
    return [];
  }
}

export function forgetLanRoomSession(roomId) {
  var id = String(roomId || '').trim();
  if (!id) return;
  writeLanKnownRooms(readLanKnownRooms().filter(function (r) { return r.id !== id; }));
  try {
    if (String(localStorage.getItem('rpc-lan-last-room') || '').trim() === id) {
      localStorage.removeItem('rpc-lan-last-room');
    }
  } catch (_e) { void _e; }
}

export function rememberLanRoomJoined(roomId, displayName) {
  var id = String(roomId || '').trim();
  if (!id) return;
  var label = String(displayName || '').trim() || id.slice(0, 14);
  var next = [{ id: id, label: label, joinedAt: Date.now() }];
  readLanKnownRooms().forEach(function (r) {
    if (r.id !== id) next.push(r);
  });
  writeLanKnownRooms(next);
}

export function appendLanKnownSessionsSection(root) {
  if (!root) return;
  migrateLanLastRoomToKnown();
  var list = readLanKnownRooms();
  var sec = document.createElement('div');
  sec.className = 'lan-connect-card lan-known-sessions-card';
  var h = document.createElement('div');
  h.className = 'lan-known-sessions-title';
  h.textContent = 'Sesiones guardadas';
  sec.appendChild(h);
  if (!list.length) {
    var empty = document.createElement('p');
    empty.className = 'lan-known-sessions-empty';
    empty.textContent =
      'Aún no hay salas guardadas. Cuando estés conectado por LAN, elige una sala abajo y pulsa «Unirse»; después podrás volver a entrar desde aquí.';
    sec.appendChild(empty);
    root.appendChild(sec);
    return;
  }
  var listEl = document.createElement('div');
  listEl.className = 'lan-known-sessions-list';
  list.forEach(function (rec) {
    var row = document.createElement('div');
    row.className = 'lan-known-sessions-row';
    var lab = document.createElement('span');
    lab.className = 'lan-known-sessions-label';
    lab.textContent = String(rec.label || rec.id);
    lab.title = String(rec.id);
    var inThisRoom = String(activeLiveSyncRoomId || '') === String(rec.id || '');
    var join = document.createElement('button');
    join.type = 'button';
    join.className = 'btn-lan-secondary';
    join.style.flex = '0 0 auto';
    join.textContent = inThisRoom ? 'En sala' : 'Unirse';
    join.disabled = inThisRoom;
    join.setAttribute('data-lan-action', 'join-known');
    join.setAttribute('data-room-id', String(rec.id || ''));
    join.setAttribute('data-room-label', String(rec.label || rec.id || ''));
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-lan-danger';
    del.style.flex = '0 0 auto';
    del.textContent = 'Quitar';
    del.title = 'Quitar de la lista';
    del.setAttribute('data-lan-action', 'forget-known');
    del.setAttribute('data-room-id', String(rec.id || ''));
    row.appendChild(lab);
    row.appendChild(join);
    row.appendChild(del);
    listEl.appendChild(row);
  });
  sec.appendChild(listEl);
  var hint = document.createElement('p');
  hint.className = 'lan-known-sessions-hint';
  hint.textContent = 'Se actualizan al unirte a una sala (relay en vivo).';
  sec.appendChild(hint);
  root.appendChild(sec);
}

export function updateLanConnectionBanner(connected) {
  _lanLastConnected = !!connected;
  var el = document.getElementById('lan-connection-banner');
  if (!el) return;
  var textEl = document.getElementById('lan-connection-banner-text');
  if (connected || readLanHideDisconnectBanner()) {
    el.hidden = true;
    return;
  }
  if (textEl) textEl.textContent = LAN_DISCONNECT_BANNER_MSG;
  el.hidden = false;
}

export function syncLanDisconnectBannerPrefUi() {
  var cb = document.getElementById('lan-hide-disconnect-banner');
  if (cb) cb.checked = readLanHideDisconnectBanner();
}

export function syncLanLwwOverwriteToastPrefUi() {
  var cb = document.getElementById('settings-lan-lww-toast');
  if (cb) cb.checked = readLanLwwOverwriteToast();
}

export function setLanLwwOverwriteToastFromUi(enabled) {
  if (typeof storage.setLanLwwOverwriteToast === 'function') {
    storage.setLanLwwOverwriteToast(!!enabled);
  }
}

export function wireLanLwwToastPref() {
  var cb = document.getElementById('settings-lan-lww-toast');
  if (!cb || cb.dataset.lanLwwWired === '1') return;
  cb.dataset.lanLwwWired = '1';
  cb.addEventListener('change', function () {
    setLanLwwOverwriteToastFromUi(cb.checked);
  });
}

export function dismissLanDisconnectBanner() {
  if (typeof storage.saveLanHideDisconnectBanner === 'function') {
    storage.saveLanHideDisconnectBanner(true);
  }
  updateLanConnectionBanner(_lanLastConnected);
  syncLanDisconnectBannerPrefUi();
}

export function setLanHideDisconnectBannerFromUi(hide) {
  if (typeof storage.saveLanHideDisconnectBanner === 'function') {
    storage.saveLanHideDisconnectBanner(!!hide);
  }
  updateLanConnectionBanner(_lanLastConnected);
}

export function appendLanDisconnectBannerPref(root) {
  if (!root) return;
  var wrap = document.createElement('div');
  wrap.className = 'lan-connect-field';
  wrap.style.marginTop = '6px';
  var label = document.createElement('label');
  label.className = 'lan-disconnect-banner-pref';
  label.setAttribute('for', 'lan-hide-disconnect-banner');
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.id = 'lan-hide-disconnect-banner';
  cb.checked = readLanHideDisconnectBanner();
  cb.onchange = function () {
    setLanHideDisconnectBannerFromUi(cb.checked);
  };
  var span = document.createElement('span');
  span.textContent = 'Ocultar la franja de aviso cuando se pierde la conexión LAN';
  label.appendChild(cb);
  label.appendChild(span);
  wrap.appendChild(label);
  root.appendChild(wrap);
}

export function patchLanPanelJoinButtons() {
  if (typeof document === 'undefined') return;
  var root = document.getElementById('lan-connection-panel-root');
  if (!root) return;
  root.querySelectorAll('[data-lan-action="join-room"], [data-lan-action="join-known"]').forEach(function (btn) {
    var rid = btn.getAttribute('data-room-id') || '';
    var inRoom = String(activeLiveSyncRoomId || '') === String(rid);
    btn.textContent = inRoom ? 'En sala' : 'Unirse';
    btn.disabled = inRoom;
  });
}

/** @param {{ lanClient: object, syncLiveSyncStatusChrome: () => void }} opts */
export function wireLanPanelKnownSessionsChrome(opts) {
  if (_lanClientChromeWired || !opts || !opts.lanClient) return;
  _lanClientChromeWired = true;
  opts.lanClient.addEventListener('lan-status', function (ev) {
    updateLanConnectionBanner(!!(ev.detail && ev.detail.connected));
  });
  opts.lanClient.addEventListener('lan-patch', function () {
    opts.syncLiveSyncStatusChrome();
  });
}
