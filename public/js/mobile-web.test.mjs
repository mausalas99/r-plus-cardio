import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileWeb,
  blockIfMobileDocExport,
  activateMobileWebRoot,
  syncMobileBarebonesChrome,
} from './mobile-web.mjs';
import { getConsolidatedTabs, getSalidaSections, migrateGranularInner } from './expediente-tabs.mjs';

describe('mobile-web', () => {
  it('isMobileWeb es false sin flag', () => {
    try {
      localStorage.removeItem('rpc-mobile-mode');
    } catch (_e) { void _e; }
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g) delete g.__RPC_MOBILE_WEB__;
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('rpc-mobile-web');
    }
    assert.equal(isMobileWeb(), false);
  });

  it('activateMobileWebRoot activa clase', () => {
    if (typeof document === 'undefined') return;
    activateMobileWebRoot();
    assert.equal(isMobileWeb(), true);
    assert.ok(document.documentElement.classList.contains('rpc-mobile-web'));
  });

  it('blockIfMobileDocExport solo en móvil', () => {
    if (typeof document === 'undefined') return;
    activateMobileWebRoot();
    assert.equal(blockIfMobileDocExport(), true);
  });

  it('barebones: sin pestaña Salida ni secciones salida', () => {
    activateMobileWebRoot();
    if (!isMobileWeb()) return;
    const SALA = { appMode: 'sala', hideManejoSection: false };
    assert.equal(getConsolidatedTabs(SALA).includes('salida'), false);
    assert.deepEqual(getSalidaSections(SALA), []);
    assert.equal(migrateGranularInner('listado', SALA), 'historia');
    assert.equal(migrateGranularInner('recetaHu', SALA), 'historia');
  });

  it('syncMobileBarebonesChrome oculta controles de header', () => {
    if (typeof document === 'undefined') return;
    activateMobileWebRoot();
    document.body.innerHTML =
      '<button id="btn-export-censo-header"></button>' +
      '<button id="profile-toggle-btn"></button>' +
      '<button id="btn-open-settings"></button>' +
      '<button id="itab-salida"></button>';
    syncMobileBarebonesChrome();
    assert.equal(document.getElementById('btn-export-censo-header').style.display, 'none');
    assert.equal(document.getElementById('profile-toggle-btn').style.display, 'none');
    assert.equal(document.getElementById('btn-open-settings').style.display, 'none');
    assert.equal(document.getElementById('itab-salida').style.display, 'none');
  });
});
