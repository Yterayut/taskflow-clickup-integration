// TaskFlow Pro Enhanced Fetch Utility
// Optimized API requests with retry and caching

class EnhancedFetch {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = new Map();
        this.defaultCacheDuration = 5 * 60 * 1000; // 5 minutes
        this.requestQueue = new Map();
    }

    // Enhanced fetch with retry logic
    async fetch(url, options = {}, retries = 3) {
        const cacheKey = url + JSON.stringify(options);
        
        // Check cache first for GET requests
        if (!options.method || options.method === 'GET') {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
        
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
        } finally {
            this.requestQueue.delete(cacheKey);
        }
    }

    async executeWithRetry(url, options, retries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    timeout: 10000 // 10 second timeout
                });
                
                if (response.ok) {
                    return response;
                }
                
                // Don't retry auth errors
                if (response.status === 401 || response.status === 403) {
                    return response;
                }
                
                throw new Error(`HTTP ${response.status}`);
                
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

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

    setCache(key, response, duration = this.defaultCacheDuration) {
        this.cache.set(key, response);
        this.cacheTTL.set(key, Date.now() + duration);
    }

    clearCache() {
        this.cache.clear();
        this.cacheTTL.clear();
    }
}

// Global instance
window.enhancedFetch = new EnhancedFetch();

// Convenience methods
window.apiGet = (url) => window.enhancedFetch.fetch(url);
window.apiPost = (url, data) => window.enhancedFetch.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});