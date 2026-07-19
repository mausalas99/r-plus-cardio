/**
 * LAN panel click delegation + clinical-ops event wiring — extracted from panel.mjs.
 */
import { storage } from '../../storage.js';
import { isLanElectronDesktop, promoteThisMacToLanHost } from './transport.mjs';
import { joinLanRoom } from './room.mjs';
import {
  scheduleLiveSyncPush,
  pushClinicalOpsLanNow,
} from './push.mjs';
import { syncLanHostClinicalMetaToDisk } from './transport.mjs';
import { forgetLanRoomSession } from './panel-known-sessions.mjs';

/** @param {{
 *   runtime: () => { showToast: (msg: string, kind?: string) => void },
 *   renderLanPanel: (opts?: object) => void,
 *   refreshClinicalSessionTeams: () => Promise<void>,
 *   joinLanFromInviteUi: (btn: HTMLElement) => void,
 *   saveLanSettingsFromUi: (opts?: object) => Promise<void>,
 *   mintMobileLanPairingFromUi: () => Promise<void>,
 *   mintSalaLanPairingFromUi: () => void,
 *   reconnectFromOfflineUi: () => Promise<void>,
 *   deleteLanRoom: (roomId: string) => Promise<void>,
 * }} deps */
export function wireClinicalOpsLanSyncEvents(deps) {
  if (typeof document === 'undefined') return;
  if (!document._rpcClinicalOpsSyncedLanWired) {
    document._rpcClinicalOpsSyncedLanWired = true;
    document.addEventListener('rpc-clinical-ops-synced', function () {
      if (document.body.classList.contains('clinical-lan-directory-open')) return;
      void deps.refreshClinicalSessionTeams().then(function () {
        deps.renderLanPanel();
      });
    });
  }
  if (!document._rpcClinicalTeamsChangedLanWired) {
    document._rpcClinicalTeamsChangedLanWired = true;
    document.addEventListener('rpc-clinical-teams-changed', function () {
      void pushClinicalOpsLanNow().catch(function () {});
      scheduleLiveSyncPush();
      void syncLanHostClinicalMetaToDisk();
    });
  }
}

function dispatchLanPanelAction(action, btn, deps) {
  var handlers = {
    'join-room': function () {
      joinLanRoom(btn.getAttribute('data-room-id'), btn.getAttribute('data-room-label'));
    },
    'join-known': function () {
      joinLanRoom(btn.getAttribute('data-room-id'), btn.getAttribute('data-room-label'));
    },
    'forget-known': function () {
      forgetLanRoomSession(btn.getAttribute('data-room-id'));
      deps.renderLanPanel({ force: true });
    },
    'delete-room': function () {
      deps.deleteLanRoom(btn.getAttribute('data-room-id'));
    },
    'join-invite': function () {
      if (isLanElectronDesktop() && typeof storage.saveLanUiRole === 'function') {
        storage.saveLanUiRole('client');
      }
      deps.joinLanFromInviteUi(btn);
    },
    'host-activate': function () {
      deps.saveLanSettingsFromUi({ copyInviteAfter: true });
    },
    'mint-pairing-mobile': function () {
      void deps.mintMobileLanPairingFromUi();
    },
    'mint-pairing-sala': function () {
      void deps.mintSalaLanPairingFromUi();
    },
    'mint-pairing': function () {
      void deps.mintSalaLanPairingFromUi();
    },
    'reconnect-from-offline': function () {
      void deps.reconnectFromOfflineUi();
    },
    'become-host': function () {
      void promoteThisMacToLanHost();
    },
    'connect-turn': function () {
      void import('../../lan-shift-pin-connect.mjs')
        .then(function (m) {
          return m.tryEasyLanShiftPinConnect({ force: true });
        })
        .then(function (result) {
          if (result && result.ok) {
            deps.renderLanPanel({ force: true });
            return;
          }
          deps.runtime().showToast(
            'No encontramos el anfitrión en esta red. Pega el enlace del R4 abajo o revisa el Wi‑Fi.',
            'error'
          );
        });
    },
  };
  var handler = handlers[action];
  if (handler) handler();
}

var _lanPanelDelegationWired = false;

/** @param {ReturnType<typeof wireClinicalOpsLanSyncEvents> extends (d: infer D) => void ? D : never} deps */
export function wireLanPanelDelegation(deps) {
  if (_lanPanelDelegationWired) return;
  if (typeof document === 'undefined') return;
  var root = document.getElementById('lan-connection-panel-root');
  if (!root) return;
  _lanPanelDelegationWired = true;
  wireClinicalOpsLanSyncEvents(deps);
  root.addEventListener('click', function (ev) {
    var btn = /** @type {HTMLElement | null} */ (
      ev.target && ev.target.closest ? ev.target.closest('[data-lan-action]') : null
    );
    if (!btn || !root.contains(btn) || /** @type {HTMLButtonElement} */ (btn).disabled) return;
    var action = btn.getAttribute('data-lan-action') || '';
    if (!action) return;
    ev.preventDefault();
    ev.stopPropagation();
    dispatchLanPanelAction(action, btn, deps);
  });
}
