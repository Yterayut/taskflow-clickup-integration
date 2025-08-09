/**
 * TaskFlow Pro - Unified Frontend Optimizations
 * Consolidated frontend performance, caching, and utilities
 */

class UnifiedFrontendOptimizations {
    constructor(config = {}) {
        this.config = {
            backendUrl: config.backendUrl || 'http://192.168.20.10:7812',
            frontendUrl: config.frontendUrl || 'http://192.168.20.10:8888',
            cacheTTL: config.cacheTTL || 300000 // 5 minutes
        };
        this.cache = new Map();
        this.cacheTTL = new Map();
        this.requestQueue = new Map();
        this.metrics = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0
        };
    }

    // Enhanced Fetch with Caching and Retry
    async fetch(url, options = {}, retries = 3) {
        const cacheKey = url + JSON.stringify(options);
        this.metrics.requests++;
        
        // Check cache for GET requests
        if (!options.method || options.method === 'GET') {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.metrics.cacheHits++;
                return cached;
            }
        }
        
        this.metrics.cacheMisses++;
        
        // Check if request is already in progress
        if (this.requestQueue.has(cacheKey)) {
            return this.requestQueue.get(cacheKey);
        }
        
        // Create new request with retry logic
        const requestPromise = this.executeWithRetry(url, options, retries);
        this.requestQueue.set(cacheKey, requestPromise);
        
        try {
            const response = await requestPromise;
            
            // Cache successful GET responses
            if (response.ok && (!options.method || options.method === 'GET')) {
                this.setCache(cacheKey, response.clone());
            }
            
            return response;
        } catch (error) {
            this.metrics.errors++;
            throw error;
        } finally {
            this.requestQueue.delete(cacheKey);
        }
    }

    async executeWithRetry(url, options, retries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    timeout: 10000
                });
                
                if (response.ok) {
                    return response;
                }
                
                // Don't retry auth errors
                if (response.status === 401 || response.status === 403) {
                    return response;
                }
                
                throw new Error('HTTP ' + response.status);
                
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                
                // Exponential backoff
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Cache Management
    getFromCache(key) {
        const ttl = this.cacheTTL.get(key);
        if (ttl && ttl > Date.now()) {
            return this.cache.get(key);
        }
        
        // Clean up expired cache
        this.cache.delete(key);
        this.cacheTTL.delete(key);
        return null;
    }

    setCache(key, response, duration = this.config.cacheTTL) {
        this.cache.set(key, response);
        this.cacheTTL.set(key, Date.now() + duration);
    }

    clearCache() {
        this.cache.clear();
        this.cacheTTL.clear();
    }

    // Performance Monitoring
    startPerformanceMonitoring() {
        console.log('🚀 Frontend performance monitoring started');
        
        // Monitor fetch calls
        const originalFetch = window.fetch;
        const monitor = this;
        
        window.fetch = async function(...args) {
            const start = Date.now();
            
            try {
                const response = await originalFetch.apply(this, args);
                const duration = Date.now() - start;
                
                if (!response.ok) {
                    monitor.metrics.errors++;
                }
                
                return response;
            } catch (error) {
                monitor.metrics.errors++;
                throw error;
            }
        };
        
        // Report metrics periodically
        setInterval(() => {
            this.reportMetrics();
        }, 30000);
    }

    reportMetrics() {
        const uptime = Math.round((Date.now() - this.startTime) / 1000);
        const hitRate = this.metrics.requests > 0 ? 
            Math.round((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100) : 0;
        const errorRate = this.metrics.requests > 0 ?
            Math.round((this.metrics.errors / this.metrics.requests) * 100) : 0;
        
        console.log('📊 Frontend Performance Report (' + uptime + 's uptime)');
        console.log('   Requests:', this.metrics.requests);
        console.log('   Cache Hit Rate:', hitRate + '%');
        console.log('   Error Rate:', errorRate + '%');
    }

    getMetrics() {
        return {
            ...this.metrics,
            cacheHitRate: this.metrics.requests > 0 ? 
                Math.round((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100) : 0,
            errorRate: this.metrics.requests > 0 ?
                Math.round((this.metrics.errors / this.metrics.requests) * 100) : 0
        };
    }

    // Service Worker Integration
    generateServiceWorker() {
        return `// TaskFlow Pro Unified Service Worker
const CACHE_NAME = 'taskflow-unified-v1';
const API_CACHE_NAME = 'taskflow-api-unified-v1';

self.addEventListener('install', event => {
    console.log('TaskFlow Unified Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '/',
                '/index.html'
            ]);
        })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (url.pathname.includes('/api/v2/local/')) {
        event.respondWith(handleLocalAPI(event.request));
    } else if (url.pathname.includes('/api/v2/auth/')) {
        event.respondWith(handleAuthAPI(event.request));
    } else {
        event.respondWith(handleStaticAssets(event.request));
    }
});

async function handleLocalAPI(request) {
    const cache = await caches.open(API_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
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
        return new Response(JSON.stringify({
            success: false,
            error: 'Offline mode',
            cached: true
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleAuthAPI(request) {
    try {
        return await fetch(request);
    } catch (error) {
        const cache = await caches.open(API_CACHE_NAME);
        const cached = await cache.match(request);
        return cached || new Response('Network Error', { status: 503 });
    }
}

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

async function updateCache(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
    } catch (error) {
        // Ignore network errors in background update
    }
}`;
    }
}

// Global instance for easy access
if (typeof window !== 'undefined') {
    window.unifiedFrontend = new UnifiedFrontendOptimizations();
    window.unifiedFrontend.startTime = Date.now();
    window.unifiedFrontend.startPerformanceMonitoring();
}

module.exports = { UnifiedFrontendOptimizations };