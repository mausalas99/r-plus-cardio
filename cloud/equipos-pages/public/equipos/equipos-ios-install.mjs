/** iOS/iPadOS Add-to-Home-Screen prompt (web push requires installed PWA). */

import { isIosDevice, isStandalonePwa } from './equipos-push.mjs';

const DISMISS_KEY = 'equipos-ios-install-dismiss';

export function shouldShowIosInstallBanner() {
  if (!isIosDevice() || isStandalonePwa()) return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY) !== '1';
  } catch (_e) {
    return true;
  }
}

export function dismissIosInstallBanner() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch (_e) {
    void _e;
  }
}

export function renderIosInstallBannerHtml() {
  return (
    `<aside class="equipos-ios-install" id="equipos-ios-install" role="note">` +
    `<p class="equipos-ios-install-title">Agrega R+ Cola a Inicio para recibir avisos</p>` +
    `<p class="equipos-ios-install-lead">En iPhone, las notificaciones solo funcionan si abres la cola desde el icono en Inicio — no desde una pestaña de Safari.</p>` +
    `<ol class="equipos-ios-install-steps">` +
    `<li>Espera a que cargue la cola en <strong>Safari</strong>.</li>` +
    `<li>Pulsa <strong>Compartir</strong> (cuadrado con flecha hacia arriba).</li>` +
    `<li>Elige <strong>Agregar a pantalla de inicio</strong> y confirma.</li>` +
    `<li>Abre la cola desde el icono; luego pulsa <strong>Activar avisos</strong>.</li>` +
    `</ol>` +
    `<div class="equipos-ios-install-actions">` +
    `<button type="button" class="equipos-btn secondary" data-act="ios-install-help">Ver guía</button>` +
    `<button type="button" class="equipos-btn secondary" data-act="ios-install-dismiss">Entendido</button>` +
    `</div></aside>`
  );
}
