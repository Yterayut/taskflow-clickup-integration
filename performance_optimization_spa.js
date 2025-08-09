/**
 * TaskFlow Pro SPA - Performance Optimization
 * Phase 2c Implementation - Advanced Performance Enhancements
 */

// Service Worker for caching and offline support
const CACHE_NAME = 'taskflow-spa-v1';
const urlsToCache = [
    '/',
    '/main.js',
    '/index.html',
    '/assets/logo.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install service worker and cache resources
self.addEventListener('install', function(event) {
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
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Performance monitoring and optimization
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            apiResponseTimes: [],
            renderTimes: [],
            memoryUsage: 0,
            cacheHitRate: 0
        };
        this.startTime = performance.now();
        this.initMonitoring();
    }

    initMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            this.metrics.pageLoadTime = performance.now() - this.startTime;
            this.logMetrics();
        });

        // Monitor API response times
        this.interceptFetch();
        
        // Monitor memory usage
        this.monitorMemory();
        
        // Monitor render performance
        this.monitorRender();
    }

    interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const startTime = performance.now();
            return originalFetch(...args).then(response => {
                const endTime = performance.now();
                if (args[0].includes('/api/')) {
                    this.metrics.apiResponseTimes.push({
                        url: args[0],
                        time: endTime - startTime,
                        timestamp: Date.now()
                    });
                }
                return response;
            });
        };
    }

    monitorMemory() {
        if (performance.memory) {
            setInterval(() => {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
            }, 5000);
        }
    }

    monitorRender() {
        if (window.requestIdleCallback) {
            const measureRender = () => {
                window.requestIdleCallback(() => {
                    const renderStart = performance.now();
                    // Simulate render measurement
                    requestAnimationFrame(() => {
                        const renderEnd = performance.now();
                        this.metrics.renderTimes.push(renderEnd - renderStart);
                        measureRender();
                    });
                });
            };
            measureRender();
        }
    }

    logMetrics() {
        console.log('📊 Performance Metrics:', {
            pageLoadTime: `${this.metrics.pageLoadTime.toFixed(2)}ms`,
            averageApiResponse: `${this.getAverageApiResponse().toFixed(2)}ms`,
            memoryUsage: `${this.metrics.memoryUsage.toFixed(2)}MB`,
            averageRenderTime: `${this.getAverageRenderTime().toFixed(2)}ms`
        });
    }

    getAverageApiResponse() {
        if (this.metrics.apiResponseTimes.length === 0) return 0;
        const sum = this.metrics.apiResponseTimes.reduce((acc, curr) => acc + curr.time, 0);
        return sum / this.metrics.apiResponseTimes.length;
    }

    getAverageRenderTime() {
        if (this.metrics.renderTimes.length === 0) return 0;
        const sum = this.metrics.renderTimes.reduce((acc, curr) => acc + curr, 0);
        return sum / this.metrics.renderTimes.length;
    }

    getPerformanceReport() {
        return {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            recommendations: this.generateRecommendations()
        };
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.pageLoadTime > 3000) {
            recommendations.push('Consider code splitting to reduce initial bundle size');
        }
        
        if (this.getAverageApiResponse() > 1000) {
            recommendations.push('API responses are slow, consider caching or optimization');
        }
        
        if (this.metrics.memoryUsage > 50) {
            recommendations.push('Memory usage is high, check for memory leaks');
        }
        
        return recommendations;
    }
}

// Image lazy loading optimization
class LazyLoadingOptimizer {
    constructor() {
        this.imageObserver = null;
        this.initLazyLoading();
    }

    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        this.imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                this.imageObserver.observe(img);
            });
        }
    }
}

// API Response Caching
class ApiCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 5 * 60 * 1000; // 5 minutes
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clear() {
        this.cache.clear();
    }
}

// Bundle size optimization
class BundleOptimizer {
    constructor() {
        this.loadedModules = new Set();
        this.moduleCache = new Map();
    }

    async loadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return this.moduleCache.get(moduleName);
        }

        try {
            const module = await import(`./${moduleName}.js`);
            this.loadedModules.add(moduleName);
            this.moduleCache.set(moduleName, module);
            return module;
        } catch (error) {
            console.error(`Failed to load module ${moduleName}:`, error);
            return null;
        }
    }
}

// DOM optimization
class DOMOptimizer {
    constructor() {
        this.mutationObserver = null;
        this.initDOMOptimization();
    }

    initDOMOptimization() {
        // Batch DOM updates
        this.batchDOMUpdates();
        
        // Optimize scrolling
        this.optimizeScrolling();
        
        // Monitor DOM changes
        this.monitorDOMChanges();
    }

    batchDOMUpdates() {
        const updates = [];
        
        window.batchDOMUpdate = (callback) => {
            updates.push(callback);
            
            if (updates.length === 1) {
                requestAnimationFrame(() => {
                    updates.forEach(update => update());
                    updates.length = 0;
                });
            }
        };
    }

    optimizeScrolling() {
        let ticking = false;
        
        const onScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    // Handle scroll events
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    monitorDOMChanges() {
        if (window.MutationObserver) {
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        // Optimize newly added nodes
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.optimizeElement(node);
                            }
                        });
                    }
                });
            });

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    optimizeElement(element) {
        // Add lazy loading to images
        if (element.tagName === 'IMG') {
            element.loading = 'lazy';
        }
        
        // Optimize large lists
        if (element.children.length > 100) {
            this.implementVirtualScrolling(element);
        }
    }

    implementVirtualScrolling(container) {
        // Simple virtual scrolling implementation
        const itemHeight = 50;
        const containerHeight = container.clientHeight;
        const visibleItems = Math.ceil(containerHeight / itemHeight);
        
        let scrollTop = 0;
        let startIndex = 0;
        let endIndex = visibleItems;
        
        container.addEventListener('scroll', () => {
            scrollTop = container.scrollTop;
            startIndex = Math.floor(scrollTop / itemHeight);
            endIndex = Math.min(startIndex + visibleItems, container.children.length);
            
            // Hide/show items based on visibility
            Array.from(container.children).forEach((item, index) => {
                if (index < startIndex || index > endIndex) {
                    item.style.display = 'none';
                } else {
                    item.style.display = '';
                }
            });
        });
    }
}

// Initialize all optimizations
const performanceMonitor = new PerformanceMonitor();
const lazyLoadingOptimizer = new LazyLoadingOptimizer();
const apiCache = new ApiCache();
const bundleOptimizer = new BundleOptimizer();
const domOptimizer = new DOMOptimizer();

// Export optimization report
window.getPerformanceReport = () => {
    return {
        performance: performanceMonitor.getPerformanceReport(),
        cacheStats: {
            apiCacheSize: apiCache.cache.size,
            bundleCacheSize: bundleOptimizer.moduleCache.size
        },
        timestamp: new Date().toISOString()
    };
};

// Global performance optimization functions
window.optimizePerformance = {
    clearCache: () => {
        apiCache.clear();
        bundleOptimizer.moduleCache.clear();
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
    },
    
    preloadCriticalResources: () => {
        const criticalResources = [
            '/api/v2/auth/me',
            '/api/v2/system/health',
            '/api/v2/dashboard/config'
        ];
        
        criticalResources.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = url;
            link.as = 'fetch';
            document.head.appendChild(link);
        });
    },
    
    optimizeImages: () => {
        document.querySelectorAll('img').forEach(img => {
            if (!img.loading) {
                img.loading = 'lazy';
            }
        });
    }
};

console.log('🚀 Performance optimizations loaded');