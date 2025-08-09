/**
 * System Monitoring Middleware
 * Provides real-time system metrics and health monitoring
 */

const os = require('os');
const fs = require('fs').promises;

class SystemMonitoring {
    constructor() {
        this.metrics = {
            requests: 0,
            errors: 0,
            responseTime: [],
            lastHealthCheck: new Date(),
            systemInfo: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                pid: process.pid
            }
        };
        
        // Start periodic health checks
        this.startHealthChecks();
    }
    
    // Middleware to track requests and response times
    trackRequest(req, res, next) {
        const startTime = Date.now();
        this.metrics.requests++;
        
        // Track response time
        res.on('finish', () => {
            const responseTime = Date.now() - startTime;
            this.metrics.responseTime.push(responseTime);
            
            // Keep only last 100 response times
            if (this.metrics.responseTime.length > 100) {
                this.metrics.responseTime = this.metrics.responseTime.slice(-100);
            }
            
            // Track errors
            if (res.statusCode >= 400) {
                this.metrics.errors++;
            }
        });
        
        next();
    }
    
    // Get current system metrics
    getMetrics() {
        const avgResponseTime = this.metrics.responseTime.length > 0 
            ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
            : 0;
            
        return {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: os.loadavg(),
            requests: {
                total: this.metrics.requests,
                errors: this.metrics.errors,
                errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) + '%' : '0%'
            },
            performance: {
                averageResponseTime: Math.round(avgResponseTime),
                recentResponseTimes: this.metrics.responseTime.slice(-10),
                p95ResponseTime: this.calculatePercentile(this.metrics.responseTime, 95)
            },
            system: {
                ...this.metrics.systemInfo,
                freeMemory: os.freemem(),
                totalMemory: os.totalmem(),
                cpuCount: os.cpus().length
            }
        };
    }
    
    // Calculate percentile for response times
    calculatePercentile(arr, percentile) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile / 100) - 1;
        return sorted[index] || 0;
    }
    
    // Periodic health checks
    startHealthChecks() {
        setInterval(async () => {
            try {
                this.metrics.lastHealthCheck = new Date();
                
                // Log system metrics periodically
                const metrics = this.getMetrics();
                if (metrics.requests.total > 0 && metrics.requests.total % 100 === 0) {
                    console.log('📊 System Metrics:', {
                        requests: metrics.requests.total,
                        errorRate: metrics.requests.errorRate,
                        avgResponseTime: metrics.performance.averageResponseTime + 'ms',
                        uptime: Math.round(metrics.uptime / 60) + ' minutes'
                    });
                }
                
            } catch (error) {
                console.error('❌ Health check error:', error.message);
            }
        }, 60000); // Every minute
    }
    
    // Health check endpoint data
    getHealthStatus() {
        const metrics = this.getMetrics();
        const isHealthy = 
            metrics.performance.averageResponseTime < 5000 && // Less than 5 seconds average
            parseFloat(metrics.requests.errorRate) < 10 && // Less than 10% error rate
            metrics.memory.rss < 500 * 1024 * 1024; // Less than 500MB memory
            
        return {
            status: isHealthy ? 'healthy' : 'warning',
            timestamp: new Date().toISOString(),
            checks: {
                responseTime: {
                    status: metrics.performance.averageResponseTime < 5000 ? 'pass' : 'fail',
                    value: metrics.performance.averageResponseTime + 'ms',
                    threshold: '< 5000ms'
                },
                errorRate: {
                    status: parseFloat(metrics.requests.errorRate) < 10 ? 'pass' : 'fail',
                    value: metrics.requests.errorRate,
                    threshold: '< 10%'
                },
                memory: {
                    status: metrics.memory.rss < 500 * 1024 * 1024 ? 'pass' : 'fail',
                    value: Math.round(metrics.memory.rss / 1024 / 1024) + 'MB',
                    threshold: '< 500MB'
                }
            },
            metrics: metrics
        };
    }
}

// Create singleton instance
const systemMonitoring = new SystemMonitoring();

module.exports = { 
    systemMonitoring,
    trackRequest: (req, res, next) => systemMonitoring.trackRequest(req, res, next)
};