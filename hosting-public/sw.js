// App only, no website: replaces the old PWA service worker. Browsers that visited the old site
// still run it and show the cached website; this version clears every cache, unregisters itself
// and reloads open tabs, so the link goes to the server's 302 (APK download) from then on.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    tabs.forEach(tab => tab.navigate(tab.url).catch(() => {}));
  })());
});
// Never answer from cache: let every request go to the network (server redirects to the APK).
self.addEventListener('fetch', () => {});
