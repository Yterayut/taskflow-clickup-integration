/**
 * Database Query Optimizer for TaskFlow Pro
 * Intelligent query caching, batching, and optimization
 */

class DatabaseQueryOptimizer {
    constructor(cacheLayer) {
        this.cache = cacheLayer;
        this.queryStats = new Map();
        this.batchQueue = new Map();
        this.batchTimeout = 10; // 10ms batch window
    }

    async optimizedQuery(sql, params = [], options = {}) {
        const queryKey = this.generateQueryKey(sql, params);
        const startTime = Date.now();
        
        try {
            // Check cache first for SELECT queries
            if (sql.trim().toLowerCase().startsWith('select') && !options.skipCache) {
                const cached = this.cache.get(queryKey);
                if (cached) {
                    this.recordQueryStats(queryKey, Date.now() - startTime, true);
                    return cached;
                }
            }
            
            // Execute query
            const result = await this.executeQuery(sql, params);
            
            // Cache SELECT results
            if (sql.trim().toLowerCase().startsWith('select') && result.rows.length > 0) {
                const ttl = this.calculateCacheTTL(sql, result);
                this.cache.set(queryKey, result, ttl);
            }
            
            this.recordQueryStats(queryKey, Date.now() - startTime, false);
            return result;
            
        } catch (error) {
            this.recordQueryStats(queryKey, Date.now() - startTime, false, error);
            throw error;
        }
    }

    async batchQuery(queries) {
        const results = [];
        const uncachedQueries = [];
        
        // Check cache for all queries first
        for (const query of queries) {
            const key = this.generateQueryKey(query.sql, query.params);
            const cached = this.cache.get(key);
            
            if (cached) {
                results.push(cached);
            } else {
                uncachedQueries.push(query);
                results.push(null); // Placeholder
            }
        }
        
        // Execute uncached queries in batch
        if (uncachedQueries.length > 0) {
            const batchResults = await this.executeBatch(uncachedQueries);
            
            let batchIndex = 0;
            for (let i = 0; i < results.length; i++) {
                if (results[i] === null) {
                    results[i] = batchResults[batchIndex++];
                }
            }
        }
        
        return results;
    }

    generateQueryKey(sql, params) {
        const normalizedSQL = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        const paramHash = JSON.stringify(params);
        return `query:${normalizedSQL}:params:${paramHash}`;
    }

    calculateCacheTTL(sql, result) {
        // Dynamic TTL based on query type and result size
        const baseSQL = sql.toLowerCase().trim();
        
        if (baseSQL.includes('dashboard') || baseSQL.includes('summary')) {
            return 60000; // 1 minute for dashboard data
        }
        
        if (baseSQL.includes('user') || baseSQL.includes('profile')) {
            return 300000; // 5 minutes for user data
        }
        
        if (baseSQL.includes('system') || baseSQL.includes('status')) {
            return 30000; // 30 seconds for system data
        }
        
        // Default TTL based on result size
        const resultSize = JSON.stringify(result).length;
        if (resultSize > 100000) return 600000; // 10 minutes for large results
        if (resultSize > 10000) return 300000;  // 5 minutes for medium results
        return 120000; // 2 minutes for small results
    }

    async executeQuery(sql, params) {
        // Mock database execution
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
        
        return {
            rows: [],
            rowCount: 0,
            duration: Math.random() * 15 + 5
        };
    }

    async executeBatch(queries) {
        // Mock batch execution - would be more efficient in real database
        const results = [];
        
        for (const query of queries) {
            const result = await this.executeQuery(query.sql, query.params);
            results.push(result);
        }
        
        return results;
    }

    recordQueryStats(queryKey, duration, cached, error = null) {
        if (!this.queryStats.has(queryKey)) {
            this.queryStats.set(queryKey, {
                count: 0,
                totalTime: 0,
                cacheHits: 0,
                errors: 0,
                lastExecuted: null
            });
        }
        
        const stats = this.queryStats.get(queryKey);
        stats.count++;
        stats.totalTime += duration;
        stats.lastExecuted = Date.now();
        
        if (cached) {
            stats.cacheHits++;
        }
        
        if (error) {
            stats.errors++;
        }
    }

    getQueryStats() {
        const stats = [];
        
        for (const [query, stat] of this.queryStats) {
            stats.push({
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                count: stat.count,
                avgDuration: Math.round(stat.totalTime / stat.count),
                cacheHitRate: Math.round((stat.cacheHits / stat.count) * 100) + '%',
                errorRate: Math.round((stat.errors / stat.count) * 100) + '%',
                lastExecuted: new Date(stat.lastExecuted).toISOString()
            });
        }
        
        return stats.sort((a, b) => b.count - a.count);
    }

    getSlowestQueries(limit = 10) {
        const stats = Array.from(this.queryStats.entries())
            .map(([query, stat]) => ({
                query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                avgDuration: Math.round(stat.totalTime / stat.count),
                count: stat.count
            }))
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, limit);
        
        return stats;
    }

    async analyzePerformance() {
        const stats = this.getQueryStats();
        const totalQueries = stats.reduce((sum, stat) => sum + stat.count, 0);
        const avgResponseTime = stats.reduce((sum, stat) => sum + (stat.avgDuration * stat.count), 0) / totalQueries;
        
        return {
            totalQueries,
            avgResponseTime: Math.round(avgResponseTime),
            cacheEfficiency: this.cache.getStats(),
            slowestQueries: this.getSlowestQueries(5),
            recommendations: this.generateRecommendations(stats)
        };
    }

    generateRecommendations(stats) {
        const recommendations = [];
        
        // High frequency queries
        const highFreqQueries = stats.filter(s => s.count > 100);
        if (highFreqQueries.length > 0) {
            recommendations.push('Consider indexing for high-frequency queries');
        }
        
        // Slow queries
        const slowQueries = stats.filter(s => s.avgDuration > 100);
        if (slowQueries.length > 0) {
            recommendations.push('Optimize slow queries (>100ms average)');
        }
        
        // Low cache hit rate
        const lowCacheHit = stats.filter(s => parseInt(s.cacheHitRate) < 50);
        if (lowCacheHit.length > 0) {
            recommendations.push('Improve caching strategy for low hit rate queries');
        }
        
        return recommendations;
    }
}

module.exports = { DatabaseQueryOptimizer };