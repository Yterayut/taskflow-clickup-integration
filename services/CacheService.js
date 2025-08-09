const Redis = require('ioredis');

class CacheService {
    constructor(options = {}) {
        this.redisOptions = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: process.env.REDIS_DB || 0,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            ...options
        };

        this.redis = null;
        this.isConnected = false;
        this.memoryCache = new Map(); // Fallback memory cache
        this.maxMemoryCacheSize = options.maxMemoryCacheSize || 1000;
        
        // Cache configuration
        this.defaultTTL = options.defaultTTL || 300; // 5 minutes
        this.cacheTTLs = {
            'dashboard-data': 300,        // 5 minutes
            'team-data': 600,             // 10 minutes  
            'user-profile': 900,          // 15 minutes
            'team-ranking': 300,          // 5 minutes
            'team-tasks': 180,            // 3 minutes
            'member-workload': 240,       // 4 minutes
            'clickup-spaces': 1800,       // 30 minutes
            'clickup-lists': 1800,        // 30 minutes
            'system-health': 60           // 1 minute
        };

        // Statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            connectionErrors: 0
        };
    }

    /**
     * Initialize Redis connection
     */
    async connect() {
        try {
            console.log('🔄 Initializing Redis Cache Service...');
            
            this.redis = new Redis(this.redisOptions);
            
            // Event handlers
            this.redis.on('connect', () => {
                console.log('✅ Redis connected successfully');
                this.isConnected = true;
            });

            this.redis.on('error', (error) => {
                console.error('❌ Redis connection error:', error.message);
                this.isConnected = false;
                this.stats.connectionErrors++;
            });

            this.redis.on('close', () => {
                console.warn('⚠️ Redis connection closed');
                this.isConnected = false;
            });

            this.redis.on('reconnecting', () => {
                console.log('🔄 Redis reconnecting...');
            });

            // Test connection
            await this.redis.ping();
            console.log('✅ Redis Cache Service initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Redis:', error.message);
            console.log('📝 Falling back to memory cache only');
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Get value from cache with fallback to memory cache
     */
    async get(key) {
        try {
            // Try Redis first
            if (this.isConnected && this.redis) {
                const value = await this.redis.get(this.formatKey(key));
                if (value !== null) {
                    this.stats.hits++;
                    return JSON.parse(value);
                }
            }

            // Fallback to memory cache
            if (this.memoryCache.has(key)) {
                const cachedItem = this.memoryCache.get(key);
                if (cachedItem.expiry > Date.now()) {
                    this.stats.hits++;
                    return cachedItem.data;
                } else {
                    this.memoryCache.delete(key);
                }
            }

            this.stats.misses++;
            return null;

        } catch (error) {
            console.error(`❌ Cache GET error for key ${key}:`, error.message);
            this.stats.errors++;
            return null;
        }
    }

    /**
     * Set value in cache with dual storage (Redis + Memory)
     */
    async set(key, value, ttl = null) {
        try {
            const finalTTL = ttl || this.getCacheTTL(key);
            const serializedValue = JSON.stringify(value);

            // Set in Redis
            if (this.isConnected && this.redis) {
                await this.redis.setex(this.formatKey(key), finalTTL, serializedValue);
            }

            // Set in memory cache as fallback
            this.setMemoryCache(key, value, finalTTL);

            this.stats.sets++;
            return true;

        } catch (error) {
            console.error(`❌ Cache SET error for key ${key}:`, error.message);
            this.stats.errors++;
            
            // Try to set in memory cache at least
            try {
                const finalTTL = ttl || this.getCacheTTL(key);
                this.setMemoryCache(key, value, finalTTL);
                return true;
            } catch (memError) {
                console.error('❌ Memory cache fallback failed:', memError.message);
                return false;
            }
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key) {
        try {
            // Delete from Redis
            if (this.isConnected && this.redis) {
                await this.redis.del(this.formatKey(key));
            }

            // Delete from memory cache
            this.memoryCache.delete(key);

            this.stats.deletes++;
            return true;

        } catch (error) {
            console.error(`❌ Cache DELETE error for key ${key}:`, error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Delete multiple keys by pattern
     */
    async deletePattern(pattern) {
        try {
            if (this.isConnected && this.redis) {
                const keys = await this.redis.keys(this.formatKey(pattern));
                if (keys.length > 0) {
                    await this.redis.del(keys);
                    this.stats.deletes += keys.length;
                }
            }

            // Also clear from memory cache
            for (const key of this.memoryCache.keys()) {
                if (key.includes(pattern)) {
                    this.memoryCache.delete(key);
                }
            }

            return true;

        } catch (error) {
            console.error(`❌ Cache DELETE PATTERN error for ${pattern}:`, error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Get or Set pattern (get from cache, or execute function and cache result)
     */
    async getOrSet(key, asyncFunction, ttl = null) {
        try {
            // Try to get from cache first
            const cached = await this.get(key);
            if (cached !== null) {
                return {
                    data: cached,
                    source: 'cache',
                    cache_hit: true
                };
            }

            // Execute function and cache result
            const result = await asyncFunction();
            if (result !== null && result !== undefined) {
                await this.set(key, result, ttl);
            }

            return {
                data: result,
                source: 'live_fetch',
                cache_hit: false
            };

        } catch (error) {
            console.error(`❌ Cache GET_OR_SET error for key ${key}:`, error.message);
            this.stats.errors++;
            
            // If cache fails, still return the function result
            try {
                const result = await asyncFunction();
                return {
                    data: result,
                    source: 'direct_fetch',
                    cache_hit: false
                };
            } catch (funcError) {
                console.error('❌ Function execution also failed:', funcError.message);
                throw funcError;
            }
        }
    }

    /**
     * Set memory cache with TTL
     */
    setMemoryCache(key, value, ttl) {
        // Cleanup old entries if cache is too large
        if (this.memoryCache.size >= this.maxMemoryCacheSize) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }

        this.memoryCache.set(key, {
            data: value,
            expiry: Date.now() + (ttl * 1000)
        });
    }

    /**
     * Get appropriate TTL for cache key
     */
    getCacheTTL(key) {
        for (const [pattern, ttl] of Object.entries(this.cacheTTLs)) {
            if (key.includes(pattern)) {
                return ttl;
            }
        }
        return this.defaultTTL;
    }

    /**
     * Format cache key with prefix
     */
    formatKey(key) {
        return `taskflow:${key}`;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            isConnected: this.isConnected,
            memoryCacheSize: this.memoryCache.size,
            healthScore: this.calculateHealthScore()
        };
    }

    /**
     * Calculate cache health score
     */
    calculateHealthScore() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses))
            : 1;

        const errorRate = this.stats.sets > 0
            ? (this.stats.errors / this.stats.sets)
            : 0;

        const connectionHealth = this.isConnected ? 1 : 0.5;

        return Math.round((hitRate * 0.5 + (1 - errorRate) * 0.3 + connectionHealth * 0.2) * 100);
    }

    /**
     * Close connections
     */
    async disconnect() {
        try {
            if (this.redis && this.isConnected) {
                await this.redis.quit();
            }
            this.memoryCache.clear();
            console.log('✅ Cache service closed successfully');
        } catch (error) {
            console.error('❌ Error closing cache service:', error.message);
        }
    }

    /**
     * Clear all cache
     */
    async clear() {
        try {
            if (this.isConnected && this.redis) {
                const keys = await this.redis.keys('taskflow:*');
                if (keys.length > 0) {
                    await this.redis.del(keys);
                }
            }

            this.memoryCache.clear();
            console.log('✅ Cache cleared successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to clear cache:', error.message);
            return false;
        }
    }

    /**
     * Check if cache service is ready
     */
    isReady() {
        return this.isConnected || this.memoryCache.size >= 0; // Always ready with memory fallback
    }

    /**
     * Get cache health status
     */
    getHealthStatus() {
        return {
            status: this.isConnected ? 'healthy' : 'degraded',
            redis: {
                connected: this.isConnected,
                host: this.redisOptions.host,
                port: this.redisOptions.port
            },
            memoryCache: {
                size: this.memoryCache.size,
                maxSize: this.maxMemoryCacheSize
            },
            stats: this.getStats(),
            lastError: this.stats.errors > 0 ? 'Check logs for details' : null
        };
    }

    // Specific cache keys for TaskFlow Pro
    static CACHE_KEYS = {
        DASHBOARD_DATA: 'dashboard-data',
        USER_TASKS: 'user-tasks',
        TEAMS: 'team-data',
        SPACES: 'clickup-spaces',
        LISTS: 'clickup-lists',
        MEMBERS: 'team-members',
        RANKING: 'team-ranking',
        WORKLOAD: 'member-workload'
    };

    // TTL configurations for different data types
    static TTL = {
        DASHBOARD: 300,      // 5 minutes
        USER_DATA: 600,      // 10 minutes
        TEAM_DATA: 600,      // 10 minutes
        RANKING: 300,        // 5 minutes
        STATIC_DATA: 1800    // 30 minutes
    };
}

module.exports = CacheService;