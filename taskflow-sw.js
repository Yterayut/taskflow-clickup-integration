// TaskFlow Pro Service Worker
// Optimized caching for better performance

const CACHE_NAME = 'taskflow-v1';
const API_CACHE_NAME = 'taskflow-api-v1';

// Install service worker
self.addEventListener('install', event => {
    console.log('TaskFlow Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/fetch-utility.js',
                '/performance-monitor.js'
            ]);
        })
    );
});

// Handle fetch requests
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Cache strategy for local database API
    if (url.pathname.includes('/api/v2/local/')) {
        event.respondWith(handleLocalAPI(event.request));
    }
    // Network-first for auth endpoints
    else if (url.pathname.includes('/api/v2/auth/')) {
        event.respondWith(handleAuthAPI(event.request));
    }
    // Cache-first for static assets
    else {
        event.respondWith(handleStaticAssets(event.request));
    }
});

// Cache-first strategy for local database
async function handleLocalAPI(request) {
    const cache = await caches.open(API_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        // Serve from cache, update in background
        updateCache(request, cache);
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Offline fallback
        return new Response(JSON.stringify({
            success: false,
            error: 'Offline mode',
            cached: true
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Network-first for authentication
async function handleAuthAPI(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch (error) {
        const cache = await caches.open(API_CACHE_NAME);
        const cached = await cache.match(request);
        return cached || new Response('Network Error', { status: 503 });
    }
}

// Cache-first for static assets
async function handleStaticAssets(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

// Background cache update
async function updateCache(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
    } catch (error) {
        // Ignore network errors in background update
    }
}