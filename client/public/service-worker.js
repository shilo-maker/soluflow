/* eslint-disable no-restricted-globals */

// Service Worker for SoluFlow - Offline Support
// Increment version manually when deploying significant updates
const CACHE_VERSION = '3.1.0';
const CACHE_NAME = `soluflow-v${CACHE_VERSION}`;

// Assets to cache on install for offline support
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/solu_flow_logo.png',
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// External font URLs to cache for offline support
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v' + CACHE_VERSION + '...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[Service Worker] Failed to cache some assets:', error);
        // Don't fail the install if some assets can't be cached
        return Promise.resolve();
      });
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old version caches, keep current
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating v' + CACHE_VERSION + '...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          // Only delete caches that are NOT the current version
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle Google Fonts - cache for offline use
  if (FONT_ORIGINS.some(origin => url.origin === origin)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Font failed to load - return empty response, CSS fallbacks will handle it
          return new Response('', { status: 404 });
        });
      })
    );
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Never cache API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For HTML documents (including index.html) - Network first with cache for offline
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the HTML for offline use (but always fetch fresh when online)
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving HTML from cache (offline mode)');
              return cachedResponse;
            }
            // If no cached HTML, return dedicated offline page
            return caches.match('/offline.html').then((offlinePage) => {
              if (offlinePage) {
                return offlinePage;
              }
              // Fallback if offline.html not cached
              return new Response(
                '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - SoluFlow</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1a1a2e;color:#fff}.offline{text-align:center;padding:2rem}h1{color:#d4a560;margin-bottom:1rem}p{opacity:0.8}</style></head><body><div class="offline"><h1>You\'re Offline</h1><p>Please check your internet connection and try again.</p></div></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          });
        })
    );
    return;
  }

  // Static assets (JS, CSS, images) - Network first, fallback to cache
  // Using network-first ensures users always get fresh hashed bundles after deploys
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return nothing for failed static asset requests
          return new Response('', { status: 404 });
        });
      })
  );
});

// Message event - allow cache updates from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urls);
      })
    );
  }
});
