/**
 * TaskFlow Pro SPA - Service Worker
 * Caching and offline support
 */

const CACHE_NAME = 'taskflow-spa-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/main.js',
    '/performance_optimization_spa.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install service worker
self.addEventListener('install', function(event) {
    console.log('📦 Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('📦 Service Worker: Caching app shell');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch from cache first, then network
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Cache hit - return response
                if (response) {
                    console.log('📦 Cache hit:', event.request.url);
                    return response;
                }
                
                // Network request
                return fetch(event.request).then(function(response) {
                    // Don't cache API responses
                    if (event.request.url.includes('/api/')) {
                        return response;
                    }
                    
                    // Cache other resources
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    
                    return response;
                });
            })
    );
});

// Activate service worker
self.addEventListener('activate', function(event) {
    console.log('📦 Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('📦 Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for offline functionality
self.addEventListener('sync', function(event) {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

function doBackgroundSync() {
    return fetch('/api/v2/system/health')
        .then(response => response.json())
        .then(data => {
            console.log('📦 Background sync completed:', data);
        })
        .catch(error => {
            console.error('📦 Background sync failed:', error);
        });
}

// Push notification handling
self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'New notification',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('TaskFlow Pro', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', function(event) {
    console.log('📦 Notification click received.');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});