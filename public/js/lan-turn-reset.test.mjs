import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAN_TURN_RESET_CLIENT_CONFIRM,
  performLanTurnClientReset,
} from './lan-turn-reset.mjs';
import {
  recordWardHostUrl,
  loadWardHostRegistry,
} from './lan-ward-host-registry.mjs';

const jsDir = join(dirname(fileURLToPath(import.meta.url)));
const panelHostPinSrc = readFileSync(join(jsDir, 'features/lan/panel-host-pin.mjs'), 'utf8');
const panelRenderOnceSrc = readFileSync(join(jsDir, 'features/lan/panel-render-once.mjs'), 'utf8');
const panelSrc =
  readFileSync(join(jsDir, 'features/lan/panel.mjs'), 'utf8') + '\n' + panelHostPinSrc;
const orchestratorSrc = readFileSync(join(jsDir, 'features/lan/orchestrator.mjs'), 'utf8');

describe('lan-turn-reset', () => {
  it('exports client confirm copy', () => {
    assert.match(LAN_TURN_RESET_CLIENT_CONFIRM, /Wi‑Fi/);
    assert.match(LAN_TURN_RESET_CLIENT_CONFIRM, /no se borran/);
  });

  it('leaves room silently and disconnects LAN client', async () => {
    const leave = mock.fn();
    const disconnect = mock.fn();
    const store = {
      getItem(k) {
        return this._[k] ?? null;
      },
      setItem(k, v) {
        this._[k] = String(v);
      },
      removeItem(k) {
        delete this._[k];
      },
      _: { 'rpc-lan-ui-role': 'host', 'rpc-lan-config': '{"hostUrl":"http://10.0.0.1:3738"}' },
    };
    const origLs = globalThis.localStorage;
    const origSs = globalThis.sessionStorage;
    globalThis.localStorage = store;
    recordWardHostUrl('http://10.0.57.52:3738', { source: 'host' });
    assert.ok(loadWardHostRegistry().hostUrls.length > 0);
    globalThis.sessionStorage = { removeItem() {} };
    try {
      const res = await performLanTurnClientReset({
        leaveLiveSyncRoom: leave,
        lanClient: { disconnect },
      });
      assert.equal(res.mode, 'client');
      assert.equal(leave.mock.callCount(), 1);
      assert.deepEqual(leave.mock.calls[0].arguments[0], { silentLeave: true });
      assert.equal(disconnect.mock.callCount(), 1);
      assert.equal(store.getItem('rpc-lan-ui-role'), 'client');
      assert.equal(store.getItem('rpc-lan-config'), null);
      const reg = loadWardHostRegistry();
      assert.ok(reg.hostUrls.some((e) => e.url === 'http://10.0.57.65:3738'));
    } finally {
      globalThis.localStorage = origLs;
      globalThis.sessionStorage = origSs;
    }
  });

  it('wires reset UI in ⇄ panel and window handlers', () => {
    assert.match(panelSrc, /resetLanTurnConnectionFromUi/);
    assert.match(panelSrc, /appendLanTurnResetAlertStrip/);
    assert.match(panelSrc, /lan-turn-reset\.mjs/);
    assert.match(orchestratorSrc, /resetLanTurnConnectionFromUi/);
  });

  it('does not force re-render from pinned-host alert strip (flash loop guard)', () => {
    assert.doesNotMatch(
      panelHostPinSrc,
      /appendLanTurnResetAlertStrip[\s\S]*applyPinnedHostOverride[\s\S]*renderLanPanel\(\{ force: true \}\)/
    );
    assert.doesNotMatch(panelHostPinSrc, /if \(cb\.checked && !lanClient\.connected/);
    assert.doesNotMatch(panelRenderOnceSrc, /pinned && !isLanConnectionDropdownOpen\(\)/);
  });
});
