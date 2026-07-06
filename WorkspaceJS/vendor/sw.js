// Service Worker for Workspace Hub PWA
const CACHE_NAME = 'workspace-hub-v3';
const STATIC_ASSETS = [
  'Workspace.html',
  'WorkspaceCSS/reset.css',
  'WorkspaceCSS/variables.css',
  'WorkspaceCSS/layout.css',
  'WorkspaceCSS/schedule.css',
  'WorkspaceCSS/dashboard.css',
  'WorkspaceCSS/lessons.css',
  'WorkspaceCSS/tasks.css',
  'WorkspaceCSS/library.css',
  'WorkspaceCSS/widgets.css',
  'WorkspaceCSS/modals.css',
  'WorkspaceCSS/animations.css',
  'WorkspaceCSS/analytics.css',
  'WorkspaceCSS/schedule-graph.css',
  'WorkspaceCSS/dev-tools.css',
  'WorkspaceCSS/timer.css',
  'WorkspaceCSS/timer-ai.css',
  'WorkspaceCSS/timer-widgets.css',
  'WorkspaceCSS/weather.css',
  'WorkspaceJS/config.js',
  'WorkspaceJS/helpers.js',
  'WorkspaceJS/theme.js',
  'WorkspaceJS/notifications.js',
  'WorkspaceJS/analytics.js',
  'WorkspaceJS/undo-redo.js',
  'WorkspaceJS/drag-drop.js',
  'WorkspaceJS/context-menu.js',
  'WorkspaceJS/schedule-core.js',
  'WorkspaceJS/schedule-planner.js',
  'WorkspaceJS/dashboard.js',
  'WorkspaceJS/timer-core.js',      // ← NEW
  'WorkspaceJS/timer-ai.js',        // ← NEW
  'WorkspaceJS/timer-ui.js',        // ← NEW
  'WorkspaceJS/timer-widgets.js',   // ← NEW
  'WorkspaceJS/weather.js',
  'WorkspaceJS/lessons.js',
  'WorkspaceJS/graph.js',
  'WorkspaceJS/tasks.js',
  'WorkspaceJS/library.js',
  'WorkspaceJS/widgets.js',
  'WorkspaceJS/calendar.js',
  'WorkspaceJS/app.js',
  'WorkspaceJS/schedule-graph.js',
  'WorkspaceJS/dev-tools.js',
  'WorkspaceJS/sparkles.js',
  'WorkspaceJS/templates.js',
  'WorkspaceJS/ical-export.js',
  'WorkspaceJS/tour.js',
  'manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('Workspace.html');
            }
          });
      })
  );
});

// Handle background sync (for future use)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  console.log('[SW] Performing background sync...');
  return Promise.resolve();
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Workspace Hub', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow('Workspace.html')
  );
});
