/**
 * GhoulStreams Service Worker
 * Provides offline support, caching, and PWA functionality
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `ghoulstreams-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/watch.html',
  '/Logo.svg',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Don't fail if some assets can't be cached
        console.log('[SW] Some assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip streaming/media requests - these should go directly to network
  if (url.pathname.includes('/api/') || url.pathname.includes('.m3u8') || url.pathname.includes('.ts')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first strategy for static assets
  if (shouldCacheStatic(url.pathname)) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // Network-first strategy for dynamic content
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || response;
          });
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((response) => {
          return response || new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper function to determine if a path should use cache-first strategy
function shouldCacheStatic(pathname) {
  const staticPatterns = [
    /\.(css|js|svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot)$/i,
    /^\/(?:index|watch|Logo)\.(?:html|svg)$/i
  ];
  return staticPatterns.some((pattern) => pattern.test(pathname));
}
