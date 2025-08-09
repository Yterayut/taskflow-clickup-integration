/**
 * API Response Optimizer for TaskFlow Pro
 * Response optimization, pagination, and selective field loading
 */

class APIResponseOptimizer {
    constructor() {
        this.responseCache = new Map();
        this.compressionStats = new Map();
    }

    optimizeResponse(data, req, options = {}) {
        const optimizations = {
            original: data,
            size: JSON.stringify(data).length
        };
        
        let optimized = data;
        
        // Apply optimizations in order
        optimized = this.applyFieldSelection(optimized, req.query.fields);
        optimized = this.applyPagination(optimized, req.query);
        optimized = this.applySorting(optimized, req.query.sort);
        optimized = this.applyCompression(optimized, req.headers['accept-encoding']);
        
        optimizations.optimized = optimized;
        optimizations.finalSize = JSON.stringify(optimized).length;
        optimizations.reduction = Math.round(((optimizations.size - optimizations.finalSize) / optimizations.size) * 100);
        
        return {
            data: optimized,
            meta: {
                optimization: optimizations,
                performance: this.getPerformanceMetrics(req.path)
            }
        };
    }

    applyFieldSelection(data, fields) {
        if (!fields || !data) return data;
        
        const selectedFields = fields.split(',').map(f => f.trim());
        
        if (Array.isArray(data)) {
            return data.map(item => this.selectFields(item, selectedFields));
        } else if (typeof data === 'object') {
            return this.selectFields(data, selectedFields);
        }
        
        return data;
    }

    selectFields(obj, fields) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const result = {};
        
        for (const field of fields) {
            if (field.includes('.')) {
                // Nested field selection
                const [parent, ...nested] = field.split('.');
                if (obj[parent]) {
                    if (!result[parent]) result[parent] = {};
                    const nestedValue = this.selectFields(obj[parent], [nested.join('.')]);
                    result[parent] = { ...result[parent], ...nestedValue };
                }
            } else {
                if (obj.hasOwnProperty(field)) {
                    result[field] = obj[field];
                }
            }
        }
        
        return result;
    }

    applyPagination(data, query) {
        if (!Array.isArray(data)) return data;
        
        const page = parseInt(query.page) || 1;
        const limit = Math.min(parseInt(query.limit) || 50, 1000); // Max 1000 items
        const offset = (page - 1) * limit;
        
        const paginatedData = data.slice(offset, offset + limit);
        
        return {
            data: paginatedData,
            pagination: {
                page,
                limit,
                total: data.length,
                pages: Math.ceil(data.length / limit),
                hasNext: offset + limit < data.length,
                hasPrev: page > 1
            }
        };
    }

    applySorting(data, sortParam) {
        if (!Array.isArray(data) || !sortParam) return data;
        
        const sorts = sortParam.split(',').map(s => s.trim());
        
        return data.sort((a, b) => {
            for (const sort of sorts) {
                const desc = sort.startsWith('-');
                const field = desc ? sort.substring(1) : sort;
                
                const aVal = this.getNestedValue(a, field);
                const bVal = this.getNestedValue(b, field);
                
                if (aVal < bVal) return desc ? 1 : -1;
                if (aVal > bVal) return desc ? -1 : 1;
            }
            return 0;
        });
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    applyCompression(data, acceptEncoding) {
        if (!acceptEncoding) return data;
        
        const jsonString = JSON.stringify(data);
        const originalSize = jsonString.length;
        
        // Record compression opportunity
        if (originalSize > 1024) { // Only compress if > 1KB
            this.recordCompressionStats(originalSize, acceptEncoding);
        }
        
        return data; // Return original data, compression happens at middleware level
    }

    recordCompressionStats(size, encoding) {
        const key = this.getCategoryKey(size);
        if (!this.compressionStats.has(key)) {
            this.compressionStats.set(key, {
                count: 0,
                totalSize: 0,
                encodings: new Set()
            });
        }
        
        const stats = this.compressionStats.get(key);
        stats.count++;
        stats.totalSize += size;
        stats.encodings.add(encoding);
    }

    getCategoryKey(size) {
        if (size < 1024) return 'small';
        if (size < 10240) return 'medium';
        if (size < 102400) return 'large';
        return 'xlarge';
    }

    getPerformanceMetrics(path) {
        // Mock performance metrics
        return {
            responseTime: Math.random() * 50 + 10,
            cacheHit: Math.random() > 0.3,
            compressionRatio: Math.random() * 40 + 60,
            optimizationSavings: Math.random() * 30 + 10
        };
    }

    createOptimizedMiddleware() {
        return (req, res, next) => {
            const originalJson = res.json;
            
            res.json = (data) => {
                if (req.query.optimize !== 'false') {
                    const optimized = this.optimizeResponse(data, req);
                    return originalJson.call(res, optimized);
                }
                return originalJson.call(res, data);
            };
            
            next();
        };
    }

    getOptimizationStats() {
        const stats = {
            compressionOpportunities: 0,
            totalDataOptimized: 0,
            averageOptimization: 0
        };
        
        for (const [category, data] of this.compressionStats) {
            stats.compressionOpportunities += data.count;
            stats.totalDataOptimized += data.totalSize;
        }
        
        return stats;
    }

    generateCacheKey(req) {
        const key = req.path + JSON.stringify(req.query);
        return Buffer.from(key).toString('base64');
    }

    async smartCache(req, res, next) {
        const cacheKey = this.generateCacheKey(req);
        const cached = this.responseCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            res.setHeader('X-Cache', 'HIT');
            return res.json(cached.data);
        }
        
        const originalJson = res.json;
        res.json = (data) => {
            // Cache successful responses
            if (res.statusCode < 300) {
                const ttl = this.calculateResponseTTL(req.path, data);
                this.responseCache.set(cacheKey, {
                    data,
                    timestamp: Date.now(),
                    ttl
                });
                
                // Cleanup old entries
                if (this.responseCache.size > 1000) {
                    this.cleanupCache();
                }
            }
            
            res.setHeader('X-Cache', 'MISS');
            return originalJson.call(res, data);
        };
        
        next();
    }

    calculateResponseTTL(path, data) {
        // Dynamic TTL based on endpoint and data characteristics
        if (path.includes('/local/dashboard')) return 60000;  // 1 minute
        if (path.includes('/system/status')) return 30000;   // 30 seconds
        if (path.includes('/auth/profile')) return 300000;   // 5 minutes
        
        return 120000; // 2 minutes default
    }

    cleanupCache() {
        const now = Date.now();
        const expired = [];
        
        for (const [key, value] of this.responseCache) {
            if (now - value.timestamp > value.ttl) {
                expired.push(key);
            }
        }
        
        expired.forEach(key => this.responseCache.delete(key));
    }
}

module.exports = { APIResponseOptimizer };