import assert from 'node:assert/strict';
import test from 'node:test';

import { equiposServiceWorkerConfig } from './equipos-push.mjs';

test('equiposServiceWorkerConfig uses root SW on cloud', () => {
  globalThis.window = { __EQUIPOS_API_MODE__: 'cloud' };
  const cfg = equiposServiceWorkerConfig();
  assert.equal(cfg.scope, '/');
  assert.match(cfg.url, /^\/equipos-sw\.js\?v=/);
});

test('equiposServiceWorkerConfig uses /equipos scope on LAN', () => {
  globalThis.window = { __EQUIPOS_API_MODE__: undefined };
  const cfg = equiposServiceWorkerConfig();
  assert.equal(cfg.scope, '/equipos/');
  assert.match(cfg.url, /^\/equipos\/sw\.js\?v=/);
});
