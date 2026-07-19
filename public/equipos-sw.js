/* R+ Lista de espera — service worker (Web Push, scope / — cloud PWA root) */

importScripts('/equipos/equipos-sw-sync.js?v=21', '/equipos/equipos-sw-push.js?v=21');

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.EquiposPushSync.resubscribeAndSyncAll());
});
