self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/notifications-settings';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find(client => 'focus' in client);
    if (current) {
      await current.navigate(target);
      return current.focus();
    }
    return self.clients.openWindow(target);
  })());
});
