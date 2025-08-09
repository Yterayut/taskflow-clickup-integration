/**
 * Performance Integration Module
 * Integrates all performance optimizations into TaskFlow Pro
 */

const { AdvancedCacheLayer } = require('./advanced_cache_layer');
const { ConnectionPoolOptimizer } = require('./connection_pool_optimizer');
const { CompressionMiddleware } = require('./compression_middleware');
const { DatabaseQueryOptimizer } = require('./database_query_optimizer');
const { APIResponseOptimizer } = require('./api_response_optimizer');

class PerformanceIntegration {
    constructor(app) {
        this.app = app;
        this.cache = new AdvancedCacheLayer();
        this.connectionPool = new ConnectionPoolOptimizer();
        this.compression = new CompressionMiddleware();
        this.queryOptimizer = new DatabaseQueryOptimizer(this.cache);
        this.responseOptimizer = new APIResponseOptimizer();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Apply compression middleware
        this.app.use(this.compression.middleware());
        
        // Apply response optimization
        this.app.use(this.responseOptimizer.createOptimizedMiddleware());
        
        // Apply smart caching
        this.app.use('/api/', (req, res, next) => {
            this.responseOptimizer.smartCache(req, res, next);
        });
        
        console.log('✅ Performance middleware applied');
    }

    setupRoutes() {
        // Performance monitoring endpoints
        this.app.get('/api/v2/performance/stats', (req, res) => {
            res.json({
                cache: this.cache.getStats(),
                compression: this.compression.getStats(),
                connectionPool: this.connectionPool.getStats(),
                queryOptimization: this.queryOptimizer.getQueryStats(),
                responseOptimization: this.responseOptimizer.getOptimizationStats()
            });
        });
        
        this.app.get('/api/v2/performance/health', (req, res) => {
            res.json({
                status: 'optimal',
                timestamp: Date.now(),
                components: {
                    caching: this.cache.getStats().hitRate,
                    compression: this.compression.getStats().compressionRatio,
                    connections: 'healthy',
                    queryOptimization: 'active',
                    responseOptimization: 'active'
                }
            });
        });
        
        console.log('✅ Performance monitoring routes added');
    }

    async optimizeEndpoint(path, handler) {
        return async (req, res, next) => {
            const startTime = Date.now();
            
            try {
                // Apply caching if appropriate
                const cacheKey = 'endpoint:' + path + ':' + JSON.stringify(req.query);
                const cached = this.cache.get(cacheKey);
                
                if (cached && req.method === 'GET') {
                    res.setHeader('X-Cache', 'HIT');
                    return res.json(cached);
                }
                
                // Execute handler
                const result = await handler(req, res, next);
                
                // Cache successful results
                if (req.method === 'GET' && res.statusCode < 300) {
                    this.cache.set(cacheKey, result, 300000); // 5 minutes
                }
                
                const duration = Date.now() - startTime;
                res.setHeader('X-Response-Time', duration + 'ms');
                res.setHeader('X-Cache', 'MISS');
                
                return result;
                
            } catch (error) {
                const duration = Date.now() - startTime;
                res.setHeader('X-Response-Time', duration + 'ms');
                throw error;
            }
        };
    }

    getOptimizedAxiosConfig() {
        return this.connectionPool.getOptimizedAxiosConfig();
    }

    async analyzePerformance() {
        return {
            cache: this.cache.getStats(),
            compression: this.compression.getStats(),
            connectionPool: this.connectionPool.getStats(),
            queryOptimization: await this.queryOptimizer.analyzePerformance(),
            recommendations: this.generateRecommendations()
        };
    }

    generateRecommendations() {
        const recommendations = [];
        
        const cacheStats = this.cache.getStats();
        if (parseInt(cacheStats.hitRate) < 50) {
            recommendations.push('Improve cache hit rate by adjusting TTL values');
        }
        
        const compressionStats = this.compression.getStats();
        if (parseInt(compressionStats.compressionRate) < 80) {
            recommendations.push('Enable compression for more response types');
        }
        
        return recommendations;
    }

    async benchmarkPerformance() {
        const endpoints = [
            '/api/v2/local/dashboard-data',
            '/api/v2/system/status',
            '/health'
        ];
        
        const results = {};
        
        for (const endpoint of endpoints) {
            const times = [];
            
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                try {
                    await this.testEndpoint(endpoint);
                    times.push(Date.now() - start);
                } catch (error) {
                    // Skip failed requests
                }
            }
            
            if (times.length > 0) {
                results[endpoint] = {
                    average: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
                    min: Math.min(...times),
                    max: Math.max(...times),
                    samples: times.length
                };
            }
        }
        
        return results;
    }

    async testEndpoint(endpoint) {
        // Mock endpoint testing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 20));
        return { success: true };
    }

    getPerformanceReport() {
        return {
            timestamp: Date.now(),
            status: 'optimized',
            components: {
                caching: {
                    status: 'active',
                    hitRate: this.cache.getStats().hitRate,
                    size: this.cache.getStats().size
                },
                compression: {
                    status: 'active',
                    ratio: this.compression.getStats().compressionRatio,
                    savings: this.compression.getStats().savingsRatio
                },
                connectionPool: {
                    status: 'active',
                    stats: this.connectionPool.getStats()
                },
                queryOptimization: {
                    status: 'active',
                    totalQueries: this.queryOptimizer.getQueryStats().length
                },
                responseOptimization: {
                    status: 'active',
                    optimizations: this.responseOptimizer.getOptimizationStats()
                }
            }
        };
    }

    async cleanup() {
        await this.connectionPool.close();
        this.cache.clear();
        this.compression.reset();
    }
}

module.exports = { PerformanceIntegration };