/**
 * =====================================================
 *  SERVICE WORKER - PPDB Kota Banjar
 *  Version: 1.0.1
 *
 *  Features:
 *  - Cache-first strategy for static assets
 *  - Network-first strategy for HTML pages
 *  - Offline fallback page
 *  - Safe handling for Supabase API
 *  - Background sync ready
 * =====================================================
 */

const CACHE_NAME = 'ppdb-paud-v1.0.4';
const OFFLINE_URL = '/offline.html';

// ==========================================
// ASSETS TO PRECACHE (App Shell)
// ==========================================
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/ppdb.html',
  '/registrasi.html',
  '/offline.html',

  '/admin/login.html',
  '/admin/dashboard.html',
  '/admin/super-admin.html',

  '/css/style.css',

  '/js/config.js',
  '/js/app.js',
  '/js/ppdb.js',
  '/js/login.js',
  '/js/dashboard.js',
  '/js/super-admin.js',

  '/manifest.json',

  // External fonts / icons
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ==========================================
// INSTALL EVENT
// ==========================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Silent fail to avoid exposing internal details
      })
  );
});

// ==========================================
// ACTIVATE EVENT
// ==========================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('ppdb-paud-') &&
                name !== CACHE_NAME
            )
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// ==========================================
// FETCH EVENT
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip unsupported protocols
  if (!url.protocol.startsWith('http')) return;

  /**
   * ==========================================
   * IMPORTANT:
   * Never intercept Supabase requests
   * ==========================================
   *
   * This prevents:
   * - Failed inserts on mobile PWA
   * - Cached API responses
   * - Fake success responses
   * - Auth/session corruption
   */
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Static assets → Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages → Stale While Revalidate
  if (isHtmlPage(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default → Network First
  event.respondWith(networkFirst(request));
});

// ==========================================
// CACHE STRATEGIES
// ==========================================

/**
 * Cache First
 * Best for static assets
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    fetchAndCache(request);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);

      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);

      return (
        offlineResponse ||
        new Response('Offline', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain'
          }
        })
      );
    }

    throw error;
  }
}

/**
 * Network First
 * Best for dynamic content
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);

      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);

      if (offlineResponse) {
        return offlineResponse;
      }
    }

    return new Response('Network Error', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}

/**
 * Stale While Revalidate
 * Best for HTML pages
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

/**
 * Background cache update
 */
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);

      cache.put(request, response.clone());
    }
  } catch (error) {
    // Silent fail
  }
}

// ==========================================
// HELPERS
// ==========================================

function isStaticAsset(url) {
  const staticExtensions = [
    '.css',
    '.js',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.eot'
  ];

  const path = url.pathname.toLowerCase();

  // File extensions
  if (staticExtensions.some((ext) => path.endsWith(ext))) {
    return true;
  }

  // CDN assets
  if (url.hostname.includes('fonts.googleapis.com')) return true;
  if (url.hostname.includes('fonts.gstatic.com')) return true;
  if (url.hostname.includes('cdnjs.cloudflare.com')) return true;

  return false;
}

function isHtmlPage(url) {
  const path = url.pathname;

  return (
    path.endsWith('.html') ||
    path === '/' ||
    path.endsWith('/')
  );
}

// ==========================================
// PUSH NOTIFICATION SUPPORT
// ==========================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};

  try {
    data = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: data.body || 'Notifikasi baru dari PPDB PAUD',
    icon: '/icon192x192.png',
    badge: '/icon192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Buka'
      },
      {
        action: 'dismiss',
        title: 'Tutup'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'PPDB Kota Banjar',
      options
    )
  );
});

// ==========================================
// NOTIFICATION CLICK
// ==========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    const urlToOpen =
      event.notification.data?.url || '/';

    event.waitUntil(clients.openWindow(urlToOpen));
  }
});

// ==========================================
// MESSAGE HANDLER
// ==========================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      if (event.source) {
        event.source.postMessage({
          type: 'CACHE_CLEARED'
        });
      }
    });
  }
});