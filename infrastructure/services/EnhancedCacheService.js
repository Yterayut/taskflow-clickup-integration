/**
 * Enhanced Cache Service for TaskFlow Pro
 * Phase 2: Local Database Enhancement
 * 
 * Features:
 * - Multi-level caching (Memory + Database)
 * - Smart cache invalidation
 * - Performance monitoring
 * - Data freshness tracking
 */

class EnhancedCacheService {
    constructor(options = {}) {
        this.memoryCache = new Map();
        this.maxMemorySize = options.maxMemorySize || 100; // MB
        this.defaultTTL = options.defaultTTL || 5; // minutes
        this.memoryUsage = 0;
        
        // Database connection (mock for now)
        this.db = options.database || null;
        
        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            evictions: 0,
            totalRequests: 0
        };
        
        // Data freshness thresholds (minutes)
        this.freshnessThresholds = {
            high: 2,      // Tasks, status updates
            medium: 10,   // Projects, lists, members  
            low: 60       // Archives, historical data
        };
        
        console.log('🗄️ Enhanced Cache Service initialized');
    }

    /**
     * Get data from cache (Memory -> Database -> null)
     */
    async get(key, options = {}) {
        const startTime = Date.now();
        this.stats.totalRequests++;
        
        try {
            // Step 1: Check memory cache
            const memoryResult = this.getFromMemory(key);
            if (memoryResult && !this.isExpired(memoryResult)) {
                this.stats.hits++;
                this.recordAccess('memory', 'hit', Date.now() - startTime, key);
                return memoryResult.data;
            }
            
            // Step 2: Check database cache
            const dbResult = await this.getFromDatabase(key, options);
            if (dbResult && !this.isStale(dbResult, options.priority || 'medium')) {
                // Store in memory for faster future access
                this.setInMemory(key, dbResult.data, options.ttl);
                this.stats.hits++;
                this.recordAccess('database', 'hit', Date.now() - startTime, key);
                return dbResult.data;
            }
            
            // Cache miss
            this.stats.misses++;
            this.recordAccess('cache', 'miss', Date.now() - startTime, key);
            return null;
            
        } catch (error) {
            console.error('❌ Cache get error:', error);
            this.stats.misses++;
            return null;
        }
    }

    /**
     * Set data in cache (Memory + Database)
     */
    async set(key, data, options = {}) {
        const startTime = Date.now();
        const ttlMinutes = options.ttl || this.defaultTTL;
        const priority = options.priority || 'medium';
        const userRole = options.userRole || 'default';
        
        try {
            // Set in memory cache
            this.setInMemory(key, data, ttlMinutes);
            
            // Set in database cache
            await this.setInDatabase(key, data, {
                ttl: ttlMinutes,
                priority,
                userRole,
                dataType: options.dataType || 'general'
            });
            
            this.stats.writes++;
            this.recordAccess('cache', 'write', Date.now() - startTime, key);
            
            console.log(`💾 Cache set: ${key} (TTL: ${ttlMinutes}m, Priority: ${priority})`);
            
        } catch (error) {
            console.error('❌ Cache set error:', error);
        }
    }

    /**
     * Get from memory cache
     */
    getFromMemory(key) {
        return this.memoryCache.get(key);
    }

    /**
     * Set in memory cache with size management
     */
    setInMemory(key, data, ttlMinutes) {
        const expires = Date.now() + (ttlMinutes * 60 * 1000);
        const dataSize = this.estimateSize(data);
        
        // Check memory limit
        if (this.memoryUsage + dataSize > this.maxMemorySize * 1024 * 1024) {
            this.evictOldestEntries(dataSize);
        }
        
        this.memoryCache.set(key, {
            data,
            expires,
            size: dataSize,
            created: Date.now()
        });
        
        this.memoryUsage += dataSize;
    }

    /**
     * Get from database cache
     */
    async getFromDatabase(key, options = {}) {
        // Mock database implementation
        console.log(`🔍 Database cache lookup: ${key}`);
        return null; // No data found
    }

    /**
     * Set in database cache
     */
    async setInDatabase(key, data, options = {}) {
        const { ttl, priority, userRole, dataType } = options;
        const expiresAt = new Date(Date.now() + (ttl * 60 * 1000));
        const dataSize = this.estimateSize(data);
        
        console.log(`💾 Database cache store: ${key} -> ${dataType} (${dataSize} bytes)`);
        
        return {
            id: this.generateUUID(),
            user_role: userRole,
            data_type: dataType,
            cached_data: data,
            expires_at: expiresAt,
            data_size_bytes: dataSize,
            access_count: 1,
            created_at: new Date(),
            last_accessed: new Date()
        };
    }

    /**
     * Dashboard-specific cache methods
     */
    async getDashboardData(userRole, options = {}) {
        const cacheKey = `dashboard_${userRole}`;
        const priority = 'high';
        
        let data = await this.get(cacheKey, { priority, userRole });
        
        if (data) {
            console.log(`✅ Dashboard cache hit for role: ${userRole}`);
            return {
                ...data,
                meta: {
                    source: 'cache',
                    cached: true,
                    freshness: this.calculateFreshness(data.timestamp)
                }
            };
        }
        
        console.log(`❌ Dashboard cache miss for role: ${userRole}`);
        return null;
    }

    async setDashboardData(userRole, data, options = {}) {
        const cacheKey = `dashboard_${userRole}`;
        const enhancedData = {
            ...data,
            timestamp: new Date().toISOString(),
            userRole,
            cached: true
        };
        
        await this.set(cacheKey, enhancedData, {
            ttl: 5,
            priority: 'high',
            userRole,
            dataType: 'dashboard',
            ...options
        });
        
        console.log(`💾 Dashboard data cached for role: ${userRole}`);
    }

    async getTaskData(filters = {}) {
        const cacheKey = `tasks_${this.hashFilters(filters)}`;
        return await this.get(cacheKey, { 
            priority: 'high',
            dataType: 'tasks'
        });
    }

    async setTaskData(filters, data) {
        const cacheKey = `tasks_${this.hashFilters(filters)}`;
        await this.set(cacheKey, data, {
            ttl: 2,
            priority: 'high',
            dataType: 'tasks'
        });
    }

    async clearUserCache(userRole) {
        for (const [key, value] of this.memoryCache.entries()) {
            if (key.includes(userRole) || key.includes('dashboard')) {
                this.memoryCache.delete(key);
                this.memoryUsage -= value.size;
            }
        }
        console.log(`🗑️ Cleared cache for user role: ${userRole}`);
    }

    async clearAll() {
        this.memoryCache.clear();
        this.memoryUsage = 0;
        console.log('🗑️ All cache cleared');
    }

    isExpired(cacheItem) {
        return Date.now() > cacheItem.expires;
    }

    isStale(cacheItem, priority) {
        const threshold = this.freshnessThresholds[priority] || this.freshnessThresholds.medium;
        const ageMinutes = (Date.now() - new Date(cacheItem.created_at).getTime()) / (1000 * 60);
        return ageMinutes > threshold;
    }

    calculateFreshness(timestamp) {
        const ageMinutes = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60);
        
        if (ageMinutes < 2) return 'fresh';
        if (ageMinutes < 5) return 'good';
        if (ageMinutes < 15) return 'stale';
        return 'very_stale';
    }

    evictOldestEntries(requiredSpace) {
        const entries = Array.from(this.memoryCache.entries())
            .sort((a, b) => a[1].created - b[1].created);
        
        let freedSpace = 0;
        for (const [key, value] of entries) {
            if (freedSpace >= requiredSpace) break;
            
            this.memoryCache.delete(key);
            this.memoryUsage -= value.size;
            freedSpace += value.size;
            this.stats.evictions++;
        }
        
        console.log(`🗑️ Evicted cache entries, freed ${freedSpace} bytes`);
    }

    estimateSize(data) {
        return JSON.stringify(data).length * 2;
    }

    hashFilters(filters) {
        return Buffer.from(JSON.stringify(filters)).toString('base64').substring(0, 16);
    }

    generateUUID() {
        return 'uuid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    recordAccess(source, type, responseTime, key) {
        if (Math.random() < 0.1) {
            console.log(`📊 Cache ${source} ${type}: ${key} (${responseTime}ms)`);
        }
    }

    getHealthStatus() {
        const memoryUsageMB = this.memoryUsage / (1024 * 1024);
        const hitRate = this.stats.totalRequests > 0 ? 
            (this.stats.hits / this.stats.totalRequests * 100).toFixed(2) : 0;
        
        return {
            status: memoryUsageMB < this.maxMemorySize * 0.9 ? 'healthy' : 'warning',
            memory: {
                used_mb: Math.round(memoryUsageMB * 100) / 100,
                max_mb: this.maxMemorySize,
                usage_percent: Math.round((memoryUsageMB / this.maxMemorySize) * 100)
            },
            statistics: {
                ...this.stats,
                hit_rate_percent: parseFloat(hitRate),
                cache_entries: this.memoryCache.size
            },
            freshness_thresholds: this.freshnessThresholds
        };
    }

    getStats() {
        return {
            ...this.stats,
            memoryUsage: this.memoryUsage,
            cacheSize: this.memoryCache.size,
            hitRate: this.stats.totalRequests > 0 ? 
                (this.stats.hits / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%'
        };
    }

    async cleanup() {
        let cleanedCount = 0;
        for (const [key, value] of this.memoryCache.entries()) {
            if (this.isExpired(value)) {
                this.memoryCache.delete(key);
                this.memoryUsage -= value.size;
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
        }
        
        return cleanedCount;
    }

    startMaintenance() {
        setInterval(async () => {
            await this.cleanup();
        }, 5 * 60 * 1000);
        
        console.log('🔄 Cache maintenance started (cleanup every 5 minutes)');
    }
}

module.exports = { EnhancedCacheService };