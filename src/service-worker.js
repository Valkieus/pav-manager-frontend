// react-scripts' built-in build step auto-injects the precache manifest into
// any src/service-worker.js via workbox-webpack-plugin's InjectManifest, and
// fails the build if it can't find the injection point below — even though
// this service worker is fully hand-rolled and doesn't use workbox itself.
// eslint-disable-next-line no-unused-vars
const __precacheManifest = self.__WB_MANIFEST;

// Bumping these version suffixes changes the byte content of this file,
// which is what makes browsers notice there's a new service worker to
// install on their next update check — combined with the immediate
// registration.update() + controllerchange reload added in index.html,
// this closes the loophole where an old, already-registered service worker
// could keep serving a stale cached build (with outdated nav/permission
// logic) to a returning user for up to ~24h after a new deploy.
const CACHE_NAME = 'pav-manager-v3';
const STATIC_CACHE = 'pav-static-v3';
const DYNAMIC_CACHE = 'pav-dynamic-v3';
const API_CACHE = 'pav-api-v3';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/main.js',
  '/static/css/main.css'
];

// API routes to cache for offline
const API_ROUTES = [
  '/api/techniciens',
  '/api/salles',
  '/api/creneaux',
  '/api/enums',
  '/api/dashboard/stats',
  '/api/organigramme',
  '/api/materiel',
  '/api/devis',
  '/api/formations'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('[SW] Some static assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== API_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
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

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets and pages
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful GET requests
    if (request.method === 'GET' && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // Return offline response for API
    return new Response(
      JSON.stringify({ 
        error: 'offline', 
        message: 'Vous êtes hors ligne. Les données affichées peuvent être obsolètes.' 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static requests.
// The HTML shell (navigation requests, "/", "/index.html") is served
// NETWORK-FIRST: it's the file that references which hashed JS/CSS bundle
// to load, so serving a stale cached copy of it is what kept people stuck
// on old versions of the app after a new deploy. Hashed static assets
// (main.<hash>.js/css) are immutable for a given hash, so those are safe
// to serve cache-first.
async function handleStaticRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const url = new URL(request.url);
  const isAppShell = request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';

  if (isAppShell) {
    try {
      const networkResponse = await fetch(request, { cache: 'no-store' });
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.log('[SW] Network failed for app shell, falling back to cache:', request.url);
      const cachedResponse = await cache.match(request) || await cache.match('/index.html');
      if (cachedResponse) {
        return cachedResponse;
      }
      return new Response('Hors ligne', { status: 503 });
    }
  }

  // Non-shell static assets: cache-first, refresh in background
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    fetchAndCache(request, cache);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      trimCache(cache, 40);
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for:', request.url);
    if (request.mode === 'navigate') {
      const indexResponse = await caches.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }
    return new Response('Hors ligne', { status: 503 });
  }
}

// Fetch and update cache in background
async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response);
      trimCache(cache, 40);
    }
  } catch (error) {
    // Silently fail background fetch
  }
}

// Every new deploy leaves its old hashed JS/CSS bundle (main.<oldhash>.js)
// behind in the dynamic cache forever, since each one has a different key.
// Without a cap this grows without bound across dozens of deploys. Keep only
// the most recently-used ~40 entries (oldest inserted are evicted first).
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toDelete.map((key) => cache.delete(key)));
}

// Web Push — affiche une vraie notification système à la réception d'un
// push serveur (envoyé via pywebpush/VAPID, cf. server.py create_notification
// -> _send_web_push), même si aucun onglet PAV Manager n'est ouvert.
self.addEventListener('push', (event) => {
  let payload = { title: 'PAV Manager', body: 'Nouvelle notification', link: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (err) {
    console.log('[SW] Push payload non-JSON, fallback texte:', err);
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { link: payload.link || '/' },
      tag: payload.tag || undefined,
    })
  );
});

// Clic sur la notification système : ramène au premier onglet PAV Manager
// déjà ouvert (en le navigant vers le lien ciblé) ou en ouvre un nouveau.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'PUSH_NAVIGATE', link });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_API') {
    // Cache specific API data
    cacheApiData(event.data.urls);
  }
});

// Pre-cache API data
async function cacheApiData(urls) {
  const cache = await caches.open(API_CACHE);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        cache.put(url, response);
        console.log('[SW] Pre-cached:', url);
      }
    } catch (error) {
      console.log('[SW] Failed to pre-cache:', url);
    }
  }
}
