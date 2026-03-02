self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Minimal fetch handler to satisfy PWA criteria
  event.respondWith(fetch(event.request));
});
