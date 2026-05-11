/**
 * =====================================================
 *  SERVICE WORKER - PPDB PAUD Banjar
 *  Version: 1.0.0
 *  
 *  Features:
 *  - Cache-first strategy for static assets
 *  - Network-first strategy for API calls
 *  - Offline fallback page
 *  - Background sync support
 * =====================================================

const CACHE_NAME = 'ppdb-paud-v1.0.0';
const OFFLINE_URL = '/offline.html';

// ==========================================
// ASSETS TO PRECACHE (App Shell)
// ==========================================
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/ppdb.html',
  '/admin/login.html',
  '/admin/dashboard.html',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/js/ppdb.js',
  '/js/login.js',
  '/js/dashboard.js',
  '/js/super-admin.js',
  '/manifest.json',
  // Fonts from CDN
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ==========================================
// INSTALL EVENT
// ==========================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Precache failed:', err))
  );
});

// ==========================================
// ACTIVATE EVENT
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('ppdb-paud-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ==========================================
// FETCH EVENT - Caching Strategy
// ==========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // Strategy 1: Cache First for static assets (CSS, JS, Images, Fonts)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy 2: Network First for Supabase API calls
  if (isApiCall(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy 3: Stale While Revalidate for HTML pages
  if (isHtmlPage(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(networkFirst(request));
});

// ==========================================
// CACHING STRATEGIES
// ==========================================

/**
 * Cache First: Serve from cache, fallback to network
 * Best for: Static assets that rarely change
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetchAndCache(request);
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
    }
    
    throw error;
  }
}

/**
 * Network First: Try network, fallback to cache
 * Best for: API calls that need fresh data
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline data placeholder for API calls
    if (request.url.includes('supabase.co')) {
      return new Response(JSON.stringify({ 
        error: 'Anda sedang offline. Data mungkin tidak terbaru.' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

/**
 * Stale While Revalidate: Serve cache immediately, update in background
 * Best for: HTML pages - instant load + always fresh
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse); // Fallback to cache

  return cachedResponse || fetchPromise;
}

/**
 * Background update cache (doesn't affect response)
 */
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response);
    }
  } catch (e) {
    // Silent fail - user already got cached version
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function isStaticAsset(url) {
  const staticExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
    '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot'
  ];
  
  const path = url.pathname.toLowerCase();
  
  // Check extension
  if (staticExtensions.some(ext => path.endsWith(ext))) return true;
  
  // Check CDN domains
  if (url.hostname.includes('fonts.googleapis.com')) return true;
  if (url.hostname.includes('fonts.gstatic.com')) return true;
  if (url.hostname.includes('cdnjs.cloudflare.com')) return true;
  
  return false;
}

function isApiCall(url) {
  return url.pathname.includes('/rest/v1/') || 
         url.hostname.includes('supabase.co') ||
         url.searchParams.has('apikey');
}

function isHtmlPage(url) {
  const path = url.pathname;
  return path.endsWith('.html') || path === '/' || path.endsWith('/');
}

// ==========================================
// PUSH NOTIFICATION SUPPORT (Future)
// ==========================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || 'Notifikasi baru dari PPDB PAUD',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PPDB PAUD Banjar', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(urlToOpen));
  }
});

// ==========================================
// MESSAGE HANDLER (from main thread)
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.source.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});

console.log('[SW] Service Worker loaded successfully!');