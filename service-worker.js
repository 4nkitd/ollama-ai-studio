const CACHE_NAME = 'lama-ui-v3.1.0';
const STATIC_CACHE = 'static-v3.1.0';
const DYNAMIC_CACHE = 'dynamic-v3.1.0';
const API_CACHE = 'api-v3.1.0';
const OFFLINE_CACHE = 'offline-v3.1.0';

// Cache size limits
const DYNAMIC_CACHE_SIZE_LIMIT = 50;
const API_CACHE_SIZE_LIMIT = 30;

// Static files to cache
const STATIC_FILES = [
  '/', // Serves index.html at the root
  '/index.html',
  '/manifest.json',
  '/image.png',
  // Vite outputs assets to /assets/
  // We need to cache the generated JS and potentially CSS files.
  // Since the JS filename includes a hash, we can't hardcode it directly
  // but we can cache the /assets/ directory or use a pattern.
  // For simplicity in this example, and assuming one main JS bundle:
  '/assets/index-s2nNUWNp.js', // Manually updated from last build. For production, this needs automation.
  // Add other assets from the dist/assets folder if any (e.g., CSS, fonts, images)

  // External dependencies from importmap
  'https://cdn.tailwindcss.com', // Tailwind CSS
  'https://esm.sh/react@^19.1.0',
  'https://esm.sh/react-dom@^19.1.0/', // Note: Ensure trailing slash if importmap uses it
  'https://esm.sh/react-markdown@^10.1.0',
  'https://esm.sh/remark-gfm@^4.0.1',
  'https://esm.sh/uuid@^11.1.0',
  'https://esm.sh/lucide-react@^0.511.0',
  'https://esm.sh/react-syntax-highlighter@^15.6.1',
  'https://esm.sh/dexie@^4.0.7'
  // It's important that these URLs exactly match what index.html requests.
];

// API endpoints that should be cached
const API_ENDPOINTS = [
  '/api/tags',
  '/api/chat',
  '/api/models'
];

// Offline fallback responses
const OFFLINE_FALLBACKS = {
  '/api/tags': {
    models: []
  },
  '/api/chat': {
    error: 'offline',
    message: 'Chat is not available offline. Your message has been queued and will be sent when connection is restored.'
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES.map(url => new Request(url, { mode: 'cors' })));
      }),
      
      // Cache offline fallbacks
      caches.open(OFFLINE_CACHE).then((cache) => {
        console.log('[SW] Caching offline fallbacks');
        const offlineRequests = Object.keys(OFFLINE_FALLBACKS).map(url => {
          const response = new Response(JSON.stringify(OFFLINE_FALLBACKS[url]), {
            headers: { 'Content-Type': 'application/json' }
          });
          return cache.put(url, response);
        });
        return Promise.all(offlineRequests);
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, OFFLINE_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests with different strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Different strategies for different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else if (isESMRequest(request)) {
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
  } else {
    event.respondWith(networkFirstStrategy(request));
  }
});

// Background sync for offline queue
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'chat-queue') {
    event.waitUntil(processOfflineQueue());
  }
  
  if (event.tag === 'retry-failed-requests') {
    event.waitUntil(retryFailedRequests());
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New message received',
      icon: '/image.png',
      badge: '/image.png',
      vibrate: [100, 50, 100],
      data: data,
      actions: [
        {
          action: 'open',
          title: 'Open Chat'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Ollama AI Studio', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'QUEUE_MESSAGE') {
    queueMessage(event.data.payload);
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearAllCaches();
  }
});

// Utility functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_FILES.some(staticUrl => {
  if (staticUrl.startsWith('http')) {
    return url.href.startsWith(staticUrl);
  }
  // Match assets in the /assets/ directory, accommodating hashed filenames
  if (staticUrl.startsWith('/assets/index-') && url.pathname.startsWith('/assets/index-') && url.pathname.endsWith('.js')) {
    return true;
  }
  // Match exact paths for other static files
  return url.pathname === staticUrl;
});
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint)) ||
         url.pathname.startsWith('/api/');
}

function isESMRequest(request) {
  const url = new URL(request.url);
  return url.hostname === 'esm.sh' || url.hostname === 'cdn.skypack.dev';
}

// Cache-first strategy (for static assets)
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first strategy failed:', error);
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first strategy (for dynamic content)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      limitCacheSize(cache, DYNAMIC_CACHE_SIZE_LIMIT);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlineCache = await caches.open(OFFLINE_CACHE);
      return offlineCache.match('/') || 
             new Response('<h1>Offline</h1><p>Please check your internet connection.</p>', {
               headers: { 'Content-Type': 'text/html' }
             });
    }
    
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first with offline fallback (for API requests)
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
      limitCacheSize(cache, API_CACHE_SIZE_LIMIT);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] API request failed, checking cache and fallbacks:', request.url);
    
    // Try cache first
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try offline fallback
    const url = new URL(request.url);
    const fallbackKey = Object.keys(OFFLINE_FALLBACKS).find(key => 
      url.pathname.startsWith(key)
    );
    
    if (fallbackKey) {
      const offlineCache = await caches.open(OFFLINE_CACHE);
      const fallbackResponse = await offlineCache.match(fallbackKey);
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    
    // Queue for retry if it's a POST request that was converted to GET
    if (request.method === 'POST') {
      await queueFailedRequest(request);
    }
    
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'Service temporarily unavailable. Please try again when online.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale-while-revalidate strategy (for CDN resources)
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      limitCacheSize(cache, DYNAMIC_CACHE_SIZE_LIMIT);
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Queue management for offline requests
async function queueMessage(messageData) {
  const db = await openQueueDB();
  const transaction = db.transaction(['queue'], 'readwrite');
  const store = transaction.objectStore('queue');
  
  await store.add({
    id: Date.now(),
    data: messageData,
    timestamp: new Date(),
    retries: 0
  });
}

async function queueFailedRequest(request) {
  const db = await openQueueDB();
  const transaction = db.transaction(['failedRequests'], 'readwrite');
  const store = transaction.objectStore('failedRequests');
  
  const requestData = {
    id: Date.now(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: request.method !== 'GET' ? await request.text() : null,
    timestamp: new Date(),
    retries: 0
  };
  
  await store.add(requestData);
}

async function processOfflineQueue() {
  try {
    const db = await openQueueDB();
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const items = await store.getAll();
    
    for (const item of items) {
      try {
        // Attempt to send the queued message
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(item.data)
        });
        
        if (response.ok) {
          await store.delete(item.id);
          // Notify the main thread of successful send
          broadcastToClients({ type: 'QUEUE_ITEM_SENT', item });
        } else {
          throw new Error('Failed to send message');
        }
      } catch (error) {
        item.retries = (item.retries || 0) + 1;
        if (item.retries < 3) {
          await store.put(item);
        } else {
          await store.delete(item.id);
          broadcastToClients({ type: 'QUEUE_ITEM_FAILED', item });
        }
      }
    }
  } catch (error) {
    console.error('[SW] Error processing offline queue:', error);
  }
}

async function retryFailedRequests() {
  try {
    const db = await openQueueDB();
    const transaction = db.transaction(['failedRequests'], 'readwrite');
    const store = transaction.objectStore('failedRequests');
    const requests = await store.getAll();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          await store.delete(requestData.id);
        } else {
          throw new Error('Request failed again');
        }
      } catch (error) {
        requestData.retries = (requestData.retries || 0) + 1;
        if (requestData.retries < 3) {
          await store.put(requestData);
        } else {
          await store.delete(requestData.id);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Error retrying failed requests:', error);
  }
}

// IndexedDB for queue management
async function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServiceWorkerQueue', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('failedRequests')) {
        db.createObjectStore('failedRequests', { keyPath: 'id' });
      }
    };
  });
}

// Utility functions
async function limitCacheSize(cache, limit) {
  const keys = await cache.keys();
  if (keys.length > limit) {
    await cache.delete(keys[0]);
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

function broadcastToClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage(message));
  });
}

// Periodic cleanup
setInterval(async () => {
  try {
    // Clean up old queue items
    const db = await openQueueDB();
    const transaction = db.transaction(['queue', 'failedRequests'], 'readwrite');
    const queueStore = transaction.objectStore('queue');
    const failedStore = transaction.objectStore('failedRequests');
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Clean queue items older than 1 day
    const queueItems = await queueStore.getAll();
    for (const item of queueItems) {
      if (new Date(item.timestamp) < oneDayAgo) {
        await queueStore.delete(item.id);
      }
    }
    
    // Clean failed requests older than 1 day
    const failedItems = await failedStore.getAll();
    for (const item of failedItems) {
      if (new Date(item.timestamp) < oneDayAgo) {
        await failedStore.delete(item.id);
      }
    }
  } catch (error) {
    console.error('[SW] Error during periodic cleanup:', error);
  }
}, 60 * 60 * 1000); // Run every hour