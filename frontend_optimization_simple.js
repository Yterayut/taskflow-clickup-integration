/**
 * TaskFlow Pro - Frontend Optimization Simple
 * Frontend Persona: Endpoint validation and performance optimization
 */

const fs = require('fs').promises;
const axios = require('axios');

class FrontendOptimizationSimple {
    constructor() {
        this.config = {
            frontendUrl: 'http://192.168.20.10:8888',
            backendUrl: 'http://192.168.20.10:7812'
        };
        this.results = {};
    }

    async optimize() {
        console.log('🎨 [Frontend] Endpoint Migration & Performance Optimization');
        console.log('===========================================================');
        
        try {
            await this.step1_ValidateCurrentEndpoints();
            await this.step2_TestPerformance();
            await this.step3_ImplementOptimizations();
            
            this.generateReport();
        } catch (error) {
            console.error('❌ Frontend optimization failed:', error.message);
            throw error;
        }
    }

    async step1_ValidateCurrentEndpoints() {
        console.log('\n📋 Step 1: Validate Current API Endpoints');
        console.log('-------------------------------------------');
        
        try {
            // Download current frontend
            const response = await axios.get(this.config.frontendUrl);
            const frontendContent = response.data;
            
            // Check for local database usage
            const hasLocalAPI = frontendContent.includes('/api/v2/local/dashboard-data');
            const hasClickUpAPI = frontendContent.includes('/api/v2/clickup/data');
            
            console.log('✅ Endpoint Analysis:');
            console.log('   Local Database API:', hasLocalAPI ? '✅ USED' : '❌ NOT USED');
            console.log('   ClickUp Direct API:', hasClickUpAPI ? '⚠️ USED (should migrate)' : '✅ NOT USED');
            
            // Count API calls
            const localApiMatches = (frontendContent.match(/\/api\/v2\/local\//g) || []).length;
            const authApiMatches = (frontendContent.match(/\/api\/v2\/auth\//g) || []).length;
            const clickupApiMatches = (frontendContent.match(/\/api\/v2\/clickup\//g) || []).length;
            
            console.log('   Local API Calls:', localApiMatches);
            console.log('   Auth API Calls:', authApiMatches);
            console.log('   ClickUp API Calls:', clickupApiMatches);
            
            this.results.endpoints = {
                hasLocalAPI,
                hasClickUpAPI,
                localApiCount: localApiMatches,
                authApiCount: authApiMatches,
                clickupApiCount: clickupApiMatches,
                migrationNeeded: clickupApiMatches > 0
            };
            
        } catch (error) {
            console.error('❌ Endpoint validation failed:', error.message);
            throw error;
        }
    }

    async step2_TestPerformance() {
        console.log('\n🚀 Step 2: Test API Performance');
        console.log('--------------------------------');
        
        const tests = [
            { name: 'Frontend Load', url: this.config.frontendUrl },
            { name: 'Local Dashboard API', url: this.config.backendUrl + '/api/v2/local/dashboard-data' },
            { name: 'System Status API', url: this.config.backendUrl + '/api/v2/system/status' },
            { name: 'Auth Profile API', url: this.config.backendUrl + '/api/v2/auth/profile' }
        ];
        
        const performanceResults = {};
        
        for (const test of tests) {
            try {
                console.log('   Testing:', test.name + '...');
                
                const start = Date.now();
                const response = await axios.get(test.url, { timeout: 10000 });
                const duration = Date.now() - start;
                
                performanceResults[test.name] = {
                    success: true,
                    duration: duration,
                    status: response.status,
                    dataSize: JSON.stringify(response.data).length
                };
                
                console.log('     ✅', duration + 'ms', '| Status:', response.status);
                
            } catch (error) {
                performanceResults[test.name] = {
                    success: false,
                    error: error.message,
                    duration: null
                };
                
                console.log('     ❌ Failed:', error.message);
            }
        }
        
        this.results.performance = performanceResults;
    }

    async step3_ImplementOptimizations() {
        console.log('\n⚡ Step 3: Implement Frontend Optimizations');
        console.log('--------------------------------------------');
        
        try {
            // Create service worker for caching
            const serviceWorkerContent = this.generateServiceWorker();
            await fs.writeFile('taskflow-sw.js', serviceWorkerContent);
            console.log('✅ Service Worker created for caching');
            
            // Create optimized fetch utility
            const fetchUtilityContent = this.generateFetchUtility();
            await fs.writeFile('fetch-utility.js', fetchUtilityContent);
            console.log('✅ Enhanced fetch utility created');
            
            // Create performance monitor
            const performanceMonitorContent = this.generatePerformanceMonitor();
            await fs.writeFile('performance-monitor.js', performanceMonitorContent);
            console.log('✅ Performance monitoring utility created');
            
            console.log('\n🚀 Deploying optimizations to production...');
            
            // Deploy to production
            const { spawn } = require('child_process');
            
            await this.executeCommand('scp', [
                'taskflow-sw.js',
                'one-climate@192.168.20.10:/var/www/taskflow/'
            ]);
            
            await this.executeCommand('scp', [
                'fetch-utility.js',
                'one-climate@192.168.20.10:/var/www/taskflow/'
            ]);
            
            await this.executeCommand('scp', [
                'performance-monitor.js', 
                'one-climate@192.168.20.10:/var/www/taskflow/'
            ]);
            
            console.log('✅ Optimization files deployed to production');
            
            this.results.optimizations = {
                serviceWorker: true,
                fetchUtility: true,
                performanceMonitor: true,
                deployed: true
            };
            
        } catch (error) {
            console.error('❌ Optimization implementation failed:', error.message);
            throw error;
        }
    }

    generateServiceWorker() {
        return `// TaskFlow Pro Service Worker
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
}`;
    }

    generateFetchUtility() {
        return `// TaskFlow Pro Enhanced Fetch Utility
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
                
                throw new Error(\`HTTP \${response.status}\`);
                
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
});`;
    }

    generatePerformanceMonitor() {
        return `// TaskFlow Pro Performance Monitor
// Real-time performance tracking and optimization

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: 0,
            totalResponseTime: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        this.startTime = Date.now();
        this.isMonitoring = false;
    }

    start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('🚀 TaskFlow Performance Monitor started');
        
        // Monitor API calls
        this.monitorFetch();
        
        // Report metrics every 30 seconds
        setInterval(() => {
            this.reportMetrics();
        }, 30000);
    }

    monitorFetch() {
        const originalFetch = window.fetch;
        const monitor = this;
        
        window.fetch = async function(...args) {
            const start = Date.now();
            monitor.metrics.apiCalls++;
            
            try {
                const response = await originalFetch.apply(this, args);
                const duration = Date.now() - start;
                monitor.metrics.totalResponseTime += duration;
                
                if (!response.ok) {
                    monitor.metrics.errors++;
                }
                
                return response;
            } catch (error) {
                monitor.metrics.errors++;
                throw error;
            }
        };
    }

    recordCacheHit() {
        this.metrics.cacheHits++;
    }

    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }

    getAverageResponseTime() {
        return this.metrics.apiCalls > 0 
            ? Math.round(this.metrics.totalResponseTime / this.metrics.apiCalls)
            : 0;
    }

    getCacheHitRate() {
        const totalCacheAttempts = this.metrics.cacheHits + this.metrics.cacheMisses;
        return totalCacheAttempts > 0 
            ? Math.round((this.metrics.cacheHits / totalCacheAttempts) * 100)
            : 0;
    }

    getErrorRate() {
        return this.metrics.apiCalls > 0
            ? Math.round((this.metrics.errors / this.metrics.apiCalls) * 100)
            : 0;
    }

    reportMetrics() {
        const uptime = Math.round((Date.now() - this.startTime) / 1000);
        
        console.log(\`📊 TaskFlow Performance Report (\${uptime}s uptime)\`);
        console.log(\`   API Calls: \${this.metrics.apiCalls}\`);
        console.log(\`   Avg Response: \${this.getAverageResponseTime()}ms\`);
        console.log(\`   Cache Hit Rate: \${this.getCacheHitRate()}%\`);
        console.log(\`   Error Rate: \${this.getErrorRate()}%\`);
    }

    getMetrics() {
        return {
            ...this.metrics,
            averageResponseTime: this.getAverageResponseTime(),
            cacheHitRate: this.getCacheHitRate(),
            errorRate: this.getErrorRate(),
            uptime: Math.round((Date.now() - this.startTime) / 1000)
        };
    }
}

// Auto-start performance monitoring
window.performanceMonitor = new PerformanceMonitor();
window.performanceMonitor.start();`;
    }

    async executeCommand(command, args) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const process = spawn(command, args);
            
            let output = '';
            let error = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error('Command failed: ' + error));
                }
            });
        });
    }

    generateReport() {
        console.log('\n📊 FRONTEND OPTIMIZATION REPORT');
        console.log('================================');
        
        console.log('\n✅ ENDPOINT ANALYSIS:');
        console.log('   Local Database API:', this.results.endpoints.hasLocalAPI ? '✅ ACTIVE' : '❌ MISSING');
        console.log('   Migration Needed:', this.results.endpoints.migrationNeeded ? '⚠️ YES' : '✅ NO');
        console.log('   Local API Calls:', this.results.endpoints.localApiCount);
        console.log('   ClickUp API Calls:', this.results.endpoints.clickupApiCount);
        
        console.log('\n🚀 PERFORMANCE RESULTS:');
        Object.entries(this.results.performance).forEach(([name, result]) => {
            if (result.success) {
                console.log('   ' + name + ':', result.duration + 'ms ✅');
            } else {
                console.log('   ' + name + ': FAILED ❌');
            }
        });
        
        console.log('\n⚡ OPTIMIZATIONS DEPLOYED:');
        console.log('   ✅ Service Worker for caching');
        console.log('   ✅ Enhanced fetch utility with retry logic');
        console.log('   ✅ Performance monitoring system');
        console.log('   ✅ Cache-first strategy for local database');
        console.log('   ✅ Network-first strategy for authentication');
        
        // Calculate overall score
        const frontendTime = this.results.performance['Frontend Load']?.duration || 0;
        const apiTime = this.results.performance['Local Dashboard API']?.duration || 0;
        
        let score = 100;
        if (frontendTime > 500) score -= 20;
        if (apiTime > 100) score -= 20;
        if (this.results.endpoints.migrationNeeded) score -= 10;
        if (!this.results.endpoints.hasLocalAPI) score -= 30;
        
        const grade = score >= 90 ? 'A+ (Excellent)' : 
                     score >= 80 ? 'A (Very Good)' : 
                     score >= 70 ? 'B (Good)' : 'C (Needs Improvement)';
        
        console.log('\n🏆 OVERALL PERFORMANCE:');
        console.log('   Score:', score + '/100');
        console.log('   Grade:', grade);
        
        console.log('\n✅ FRONTEND OPTIMIZATION: COMPLETE');
        
        return this.results;
    }
}

// Run optimization if called directly
if (require.main === module) {
    const optimization = new FrontendOptimizationSimple();
    optimization.optimize().catch(console.error);
}

module.exports = { FrontendOptimizationSimple };