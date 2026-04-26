// This service worker intentionally does nothing.
// It exists to replace any previously cached SW that was intercepting /api/ requests.
// On activation it clears all caches and takes control immediately.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pass every request straight through — no caching, no interception.
self.addEventListener('fetch', () => {});
