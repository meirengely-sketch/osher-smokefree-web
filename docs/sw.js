self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let payload = { title: 'נושמים קדימה', body: 'עוד רגע בלי סיגריה מצטבר.' };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* Generic fallback. */ }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: './icon.svg', badge: './icon.svg', tag: 'smokefree-update', data: { url: payload.url || '/' } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find(c => c.url.startsWith(self.location.origin));
    if (existing) return existing.focus();
    return self.clients.openWindow(event.notification.data?.url || '/');
  }));
});
