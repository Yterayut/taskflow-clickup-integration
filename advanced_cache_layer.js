/**
 * Advanced Cache Layer for TaskFlow Pro
 * High-performance caching with TTL, LRU eviction, and clustering support
 */

class AdvancedCacheLayer {
    constructor(config = {}) {
        this.config = {
            maxSize: 1000,
            defaultTTL: 300000,      // 5 minutes
            cleanupInterval: 60000,   // 1 minute
            compressionThreshold: 1024, // 1KB
            ...config
        };
        
        this.cache = new Map();
        this.ttl = new Map();
        this.accessTimes = new Map();
        this.hitCount = 0;
        this.missCount = 0;
        
        this.startCleanup();
    }

    set(key, value, ttl = this.config.defaultTTL) {
        // Compress large values
        const serialized = JSON.stringify(value);
        const compressed = serialized.length > this.config.compressionThreshold 
            ? this.compress(serialized) 
            : serialized;
        
        // Evict if at capacity
        if (this.cache.size >= this.config.maxSize) {
            this.evictLRU();
        }
        
        this.cache.set(key, {
            value: compressed,
            compressed: serialized.length > this.config.compressionThreshold,
            size: serialized.length
        });
        
        this.ttl.set(key, Date.now() + ttl);
        this.accessTimes.set(key, Date.now());
        
        return true;
    }

    get(key) {
        // Check if expired
        if (this.isExpired(key)) {
            this.delete(key);
            this.missCount++;
            return null;
        }
        
        const item = this.cache.get(key);
        if (!item) {
            this.missCount++;
            return null;
        }
        
        // Update access time for LRU
        this.accessTimes.set(key, Date.now());
        this.hitCount++;
        
        // Decompress if needed
        const value = item.compressed 
            ? this.decompress(item.value) 
            : item.value;
        
        return JSON.parse(value);
    }

    has(key) {
        return this.cache.has(key) && !this.isExpired(key);
    }

    delete(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
        this.accessTimes.delete(key);
        return true;
    }

    clear() {
        this.cache.clear();
        this.ttl.clear();
        this.accessTimes.clear();
        this.hitCount = 0;
        this.missCount = 0;
    }

    isExpired(key) {
        const expiry = this.ttl.get(key);
        return expiry && expiry < Date.now();
    }

    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, time] of this.accessTimes) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    compress(data) {
        // Simple compression simulation (in production, use zlib)
        return Buffer.from(data).toString('base64');
    }

    decompress(compressed) {
        return Buffer.from(compressed, 'base64').toString();
    }

    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, expiry] of this.ttl) {
            if (expiry < now) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => this.delete(key));
        
        if (expiredKeys.length > 0) {
            console.log('🧹 Cache cleanup: removed', expiredKeys.length, 'expired items');
        }
    }

    getStats() {
        const total = this.hitCount + this.missCount;
        const hitRate = total > 0 ? Math.round((this.hitCount / total) * 100) : 0;
        
        return {
            size: this.cache.size,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: hitRate + '%',
            maxSize: this.config.maxSize,
            utilization: Math.round((this.cache.size / this.config.maxSize) * 100) + '%'
        };
    }

    // Optimized methods for common patterns
    async getOrSet(key, valueFunc, ttl) {
        let value = this.get(key);
        if (value === null) {
            value = await valueFunc();
            this.set(key, value, ttl);
        }
        return value;
    }

    mget(keys) {
        const results = {};
        for (const key of keys) {
            results[key] = this.get(key);
        }
        return results;
    }

    mset(entries, ttl) {
        for (const [key, value] of Object.entries(entries)) {
            this.set(key, value, ttl);
        }
    }
}

module.exports = { AdvancedCacheLayer };