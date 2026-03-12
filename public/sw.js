const CACHE_NAME = 'obsidia-v3.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap'
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls or Supabase requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return event.respondWith(fetch(event.request));
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        // Update cache with fresh version
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); // Offline: fall back to cache

      return cached || fetchPromise;
    })
  );
});

// Listen for update message from client
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
