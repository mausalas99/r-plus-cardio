import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createModalDismissRegistry,
  isRpcOverlayVisible,
  getOverlayZIndex,
  isBackdropOutsideClick,
  getDismissPanel,
} from './modal-dismiss.mjs';

test('closeTopmost cierra la capa abierta con mayor z-index', () => {
  var closed = [];
  var lowEl = { isConnected: true };
  var highEl = { isConnected: true };
  globalThis.window = globalThis;
  globalThis.getComputedStyle = function (el) {
    if (el === highEl) {
      return { display: 'flex', visibility: 'visible', opacity: '1', zIndex: '1100' };
    }
    if (el === lowEl) {
      return { display: 'flex', visibility: 'visible', opacity: '1', zIndex: '100' };
    }
    return { display: 'none', visibility: 'hidden', opacity: '1', zIndex: '0' };
  };
  var reg = createModalDismissRegistry();
  reg.register({
    isOpen: function () {
      return true;
    },
    close: function () {
      closed.push('low');
    },
    backdropEl: function () {
      return lowEl;
    },
  });
  reg.register({
    isOpen: function () {
      return true;
    },
    close: function () {
      closed.push('high');
    },
    backdropEl: function () {
      return highEl;
    },
  });
  var ev = { key: 'Escape', preventDefault() {}, stopPropagation() {} };
  assert.equal(reg.closeTopmost(ev), true);
  assert.deepEqual(closed, ['high']);
});

test('isBackdropOutsideClick distingue fondo vs panel', () => {
  var inner = {};
  var panel = {
    contains: function (n) {
      return n === panel || n === inner;
    },
  };
  var backdrop = {
    contains: function (n) {
      return n === backdrop || n === panel || n === inner;
    },
    querySelector: function (sel) {
      if (sel === '[role="dialog"]' || sel === '.modal') return panel;
      return null;
    },
  };
  assert.equal(isBackdropOutsideClick(backdrop, null, backdrop), true);
  assert.equal(isBackdropOutsideClick(backdrop, null, inner), false);
  assert.equal(getDismissPanel(backdrop, null), panel);
});

test('isRpcOverlayVisible ignora display none', () => {
  var el = { isConnected: true };
  globalThis.window = globalThis;
  globalThis.getComputedStyle = function () {
    return { display: 'none', visibility: 'visible', opacity: '1', zIndex: '0' };
  };
  assert.equal(isRpcOverlayVisible(/** @type {HTMLElement} */ (el)), false);
});

test('getOverlayZIndex lee z-index del backdrop', () => {
  var el = { isConnected: true };
  globalThis.getComputedStyle = function () {
    return { display: 'flex', visibility: 'visible', opacity: '1', zIndex: '1100' };
  };
  assert.equal(getOverlayZIndex(/** @type {HTMLElement} */ (el)), 1100);
});

test('stackZ prioriza capa anidada sobre z-index CSS bajo', () => {
  var closed = [];
  globalThis.getComputedStyle = function () {
    return { display: 'flex', visibility: 'visible', opacity: '1', zIndex: '6' };
  };
  var reg = createModalDismissRegistry();
  reg.register({
    isOpen: function () {
      return true;
    },
    close: function () {
      closed.push('registro');
    },
    backdropEl: function () {
      return { isConnected: true };
    },
    stackZ: 140,
  });
  reg.register({
    isOpen: function () {
      return true;
    },
    close: function () {
      closed.push('paste');
    },
    backdropEl: function () {
      return { isConnected: true };
    },
    stackZ: 150,
  });
  var ev = { key: 'Escape', preventDefault() {}, stopPropagation() {} };
  assert.equal(reg.closeTopmost(ev), true);
  assert.deepEqual(closed, ['paste']);
});
