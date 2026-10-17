const CACHE_NAME = 'smoke-recovery-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  // Pre-cache key SPA routes to avoid white screen in PWA on reload
  '/dashboard',
  '/admin',
  '/admin/users',
  '/admin/content',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Don't intercept non-GET, cross-origin, or API requests
  try {
    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isApi = url.pathname.startsWith('/api');
    if (request.method !== 'GET' || !isSameOrigin || isApi) {
      return; // let the browser handle it (avoids breaking POST/WS/CORS)
    }
  } catch (_) {
    // If URL parsing fails, fall back to default network handling
    return;
  }

  // Network-first for navigations (HTML) to avoid serving stale index.html
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // If the server returns OK, use it; otherwise fall back to app shell
        if (response && response.ok) return response;
        return await caches.match('/index.html');
      } catch (err) {
        // On network error (offline), serve the app shell
        return await caches.match('/index.html');
      }
    })());
    return;
  }

  // Cache-first for other assets
  event.respondWith(
    caches.match(request)
      .then((response) => response || fetch(request))
  );
});

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New Notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'BreathFresh', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});