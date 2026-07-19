/* Shared push + notificationclick handlers for equipos service workers. */

function absoluteAsset(path) {
  return new URL(path, self.location.origin).href;
}

function parsePushData(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch (_e) {
    try {
      const text = event.data.text();
      return text ? JSON.parse(text) : {};
    } catch (_e2) {
      return { body: event.data.text() || 'Actualización de cola.' };
    }
  }
}

/** iOS Safari truncates title (~30) and body (~140) in the notification shade. */
function iosSafeTitle(title) {
  const text = String(title || 'R+ Lista de espera');
  return text.length > 30 ? `${text.slice(0, 29)}…` : text;
}

function iosSafeBody(body) {
  const text = String(body || 'Actualización de cola.');
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

function defaultNotificationUrl() {
  return self.location.pathname.endsWith('/equipos-sw.js') ? '/' : '/equipos/';
}

function showQueueNotification(data) {
  const title = iosSafeTitle(data.title || 'R+ Lista de espera');
  const body = iosSafeBody(data.body || 'Actualización de cola.');
  return self.registration.showNotification(title, {
    body,
    icon: absoluteAsset(data.icon || '/equipos/icons/icon-192.png'),
    badge: absoluteAsset(data.badge || '/equipos/icons/icon-192.png'),
    tag: data.tag || 'equipos-queue',
    renotify: true,
    vibrate: [180, 80, 180],
    data: data.data || { url: defaultNotificationUrl() },
  });
}

self.addEventListener('push', (event) => {
  const data = parsePushData(event);
  event.waitUntil(showQueueNotification(data));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || defaultNotificationUrl();
  const targetUrl = new URL(target, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = client.url || '';
        if (clientUrl.startsWith(targetUrl) || clientUrl.startsWith(self.location.origin)) {
          if ('focus' in client) return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
