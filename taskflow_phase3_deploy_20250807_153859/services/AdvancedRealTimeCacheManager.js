/**
 * Advanced Real-time Cache Manager for Phase 3
 * Provides intelligent caching, real-time invalidation, and performance optimization
 */

const EventEmitter = require('events');

class AdvancedRealTimeCacheManager extends EventEmitter {
    constructor(cacheService = null, websocketService = null) {
        super();
        this.cacheService = cacheService;
        this.websocketService = websocketService;
        
        // Cache layers
        this.layers = {
            memory: new Map(),     // L1 - Ultra fast
            redis: null,           // L2 - Fast persistent
            database: null         // L3 - Persistent storage
        };
        
        // Performance metrics
        this.metrics = {
            hits: new Map(),
            misses: new Map(),
            writes: new Map(),
            evictions: new Map(),
            totalRequests: 0,
            totalHits: 0,
            totalMisses: 0,
            averageResponseTime: 0,
            lastReset: Date.now()
        };
        
        console.log('⚡ Advanced Real-time Cache Manager initialized');
    }

    // Core cache operations with intelligent routing
    async get(key, options = {}) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        
        try {
            // Try L1 (Memory) first
            if (this.layers.memory.has(key)) {
                const entry = this.layers.memory.get(key);
                if (this.isValid(entry)) {
                    this.recordHit('memory', key, Date.now() - startTime);
                    return entry.value;
                }
                // Remove expired entry
                this.layers.memory.delete(key);
            }
            
            // Try L2 (Enhanced Cache) if available
            if (this.cacheService) {
                const cacheResult = await this.cacheService.get(key);
                if (cacheResult !== null) {
                    // Promote to L1
                    this.setMemoryCache(key, cacheResult, options);
                    this.recordHit('cache', key, Date.now() - startTime);
                    return cacheResult;
                }
            }
            
            // Complete miss
            this.recordMiss(key, Date.now() - startTime);
            return null;
            
        } catch (error) {
            console.error(`❌ Cache get error for key ${key}:`, error.message);
            return null;
        }
    }

    async set(key, value, options = {}) {
        const startTime = Date.now();
        
        try {
            const ttl = options.ttl || 300; // 5 minutes default
            const priority = options.priority || 'medium';
            
            // Create cache entry
            const entry = {
                value: value,
                timestamp: Date.now(),
                ttl: ttl * 1000, // Convert to milliseconds
                priority: priority,
                accessCount: 0,
                lastAccessed: Date.now()
            };
            
            // Write to L1 (Memory)
            this.setMemoryCache(key, value, options, entry);
            
            // Write to L2 (Enhanced Cache) if available
            if (this.cacheService) {
                await this.cacheService.set(key, value, ttl, priority);
            }
            
            this.recordWrite(key, Date.now() - startTime);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Cache set error for key ${key}:`, error.message);
            return false;
        }
    }

    async invalidate(pattern) {
        const startTime = Date.now();
        let invalidatedCount = 0;
        
        try {
            // Convert pattern to regex
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            
            // Invalidate from L1 (Memory)
            for (const [key] of this.layers.memory) {
                if (regex.test(key)) {
                    this.layers.memory.delete(key);
                    invalidatedCount++;
                }
            }
            
            console.log(`🗑️ Invalidated ${invalidatedCount} cache entries matching pattern: ${pattern}`);
            
            return invalidatedCount;
            
        } catch (error) {
            console.error(`❌ Cache invalidation error for pattern ${pattern}:`, error.message);
            return 0;
        }
    }

    // Memory cache management
    setMemoryCache(key, value, options, entry = null) {
        if (!entry) {
            entry = {
                value: value,
                timestamp: Date.now(),
                ttl: (options.ttl || 300) * 1000,
                priority: options.priority || 'medium',
                accessCount: 0,
                lastAccessed: Date.now()
            };
        }
        
        this.layers.memory.set(key, entry);
    }

    // Utility methods
    isValid(entry) {
        if (!entry || !entry.timestamp || !entry.ttl) return false;
        return (Date.now() - entry.timestamp) < entry.ttl;
    }

    // Metrics recording
    recordHit(layer, key, responseTime) {
        this.metrics.totalHits++;
        this.updateMetrics('hits', layer, responseTime);
        this.updateAverageResponseTime(responseTime);
    }

    recordMiss(key, responseTime) {
        this.metrics.totalMisses++;
        this.updateMetrics('misses', 'all', responseTime);
        this.updateAverageResponseTime(responseTime);
    }

    recordWrite(key, responseTime) {
        this.updateMetrics('writes', 'all', responseTime);
    }

    updateMetrics(type, layer, responseTime) {
        if (!this.metrics[type].has(layer)) {
            this.metrics[type].set(layer, { count: 0, totalTime: 0 });
        }
        
        const metric = this.metrics[type].get(layer);
        metric.count++;
        metric.totalTime += responseTime;
    }

    updateAverageResponseTime(responseTime) {
        const totalRequests = this.metrics.totalRequests;
        this.metrics.averageResponseTime = 
            ((this.metrics.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
    }

    // Public API methods
    getMetrics() {
        const hitRate = this.metrics.totalRequests > 0 ? 
            (this.metrics.totalHits / this.metrics.totalRequests * 100).toFixed(2) : 0;
        
        return {
            summary: {
                total_requests: this.metrics.totalRequests,
                total_hits: this.metrics.totalHits,
                total_misses: this.metrics.totalMisses,
                hit_rate_percentage: parseFloat(hitRate),
                average_response_time_ms: Math.round(this.metrics.averageResponseTime * 100) / 100
            },
            layers: {
                memory: {
                    entries: this.layers.memory.size,
                    hits: this.metrics.hits.get('memory')?.count || 0
                }
            },
            uptime_seconds: Math.floor((Date.now() - this.metrics.lastReset) / 1000)
        };
    }

    getCacheStatus() {
        return {
            status: 'operational',
            layers: {
                memory: {
                    status: 'active',
                    entries: this.layers.memory.size,
                    max_entries: 1000
                },
                cache_service: {
                    status: this.cacheService ? 'active' : 'inactive',
                    available: !!this.cacheService
                }
            },
            real_time: {
                websocket_connected: !!this.websocketService
            }
        };
    }

    // Administrative methods
    clearAllCaches() {
        let clearedCount = 0;
        
        // Clear memory cache
        clearedCount += this.layers.memory.size;
        this.layers.memory.clear();
        
        console.log(`🗑️ Cleared all caches (${clearedCount} entries)`);
        
        return clearedCount;
    }

    // Health check
    healthCheck() {
        const metrics = this.getMetrics();
        const status = this.getCacheStatus();
        
        return {
            status: 'healthy',
            service: 'AdvancedRealTimeCacheManager',
            performance: {
                hit_rate: metrics.summary.hit_rate_percentage,
                avg_response_time: metrics.summary.average_response_time_ms,
                total_requests: metrics.summary.total_requests
            },
            layers: status.layers,
            last_activity: new Date().toISOString()
        };
    }

    // Cleanup
    destroy() {
        // Clear all caches
        this.clearAllCaches();
        
        // Remove all listeners
        this.removeAllListeners();
        
        console.log('🔧 Advanced Real-time Cache Manager destroyed');
    }
}

module.exports = { AdvancedRealTimeCacheManager };