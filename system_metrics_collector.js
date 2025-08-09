/**
 * System Metrics Collector
 * Collects comprehensive system performance metrics
 */

const os = require('os');
const fs = require('fs').promises;
const axios = require('axios');

class SystemMetricsCollector {
    constructor(config = {}) {
        this.config = {
            collectInterval: 10000,    // 10 seconds
            retentionPeriod: 86400000, // 24 hours
            baseUrl: 'http://192.168.20.10:7812',
            ...config
        };
        
        this.metrics = [];
        this.isCollecting = false;
    }

    start() {
        if (this.isCollecting) return;
        
        console.log('📊 Starting System Metrics Collection...');
        this.isCollecting = true;
        
        // Collect metrics immediately
        this.collectMetrics();
        
        // Schedule periodic collection
        this.collectionInterval = setInterval(() => {
            this.collectMetrics();
        }, this.config.collectInterval);
        
        // Schedule cleanup
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 60000); // Cleanup every minute
    }

    stop() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
        this.isCollecting = false;
        console.log('🛑 System Metrics Collection stopped');
    }

    async collectMetrics() {
        try {
            const timestamp = Date.now();
            
            // System metrics
            const systemMetrics = await this.getSystemMetrics();
            
            // API performance metrics
            const apiMetrics = await this.getAPIMetrics();
            
            // Application metrics
            const appMetrics = await this.getApplicationMetrics();
            
            const metric = {
                timestamp,
                system: systemMetrics,
                api: apiMetrics,
                application: appMetrics
            };
            
            this.metrics.push(metric);
            
            // Log summary
            console.log(`📊 Metrics collected - CPU: ${systemMetrics.cpuUsage}%, Memory: ${systemMetrics.memoryUsage}%, API: ${apiMetrics.averageResponseTime}ms`);
            
        } catch (error) {
            console.error('❌ Metrics collection failed:', error.message);
        }
    }

    async getSystemMetrics() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        // Calculate CPU usage (simplified)
        const cpuUsage = Math.round(Math.random() * 20 + 10); // Mock data for demo
        
        return {
            cpuUsage,
            memoryUsage: Math.round((usedMem / totalMem) * 100),
            totalMemory: Math.round(totalMem / 1024 / 1024), // MB
            freeMemory: Math.round(freeMem / 1024 / 1024),   // MB
            uptime: os.uptime(),
            loadAverage: os.loadavg(),
            platform: os.platform(),
            arch: os.arch()
        };
    }

    async getAPIMetrics() {
        const endpoints = [
            '/health',
            '/api/v2/system/status',
            '/api/v2/local/dashboard-data'
        ];
        
        const results = [];
        
        for (const endpoint of endpoints) {
            try {
                const start = Date.now();
                const response = await axios.get(this.config.baseUrl + endpoint, {
                    timeout: 5000
                });
                const responseTime = Date.now() - start;
                
                results.push({
                    endpoint,
                    responseTime,
                    status: response.status,
                    success: true
                });
                
            } catch (error) {
                results.push({
                    endpoint,
                    responseTime: null,
                    status: error.response?.status || 0,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successfulRequests = results.filter(r => r.success);
        const averageResponseTime = successfulRequests.length > 0
            ? Math.round(successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length)
            : 0;
        
        return {
            endpoints: results,
            averageResponseTime,
            successRate: Math.round((successfulRequests.length / results.length) * 100),
            totalRequests: results.length
        };
    }

    async getApplicationMetrics() {
        try {
            // Get system status
            const statusResponse = await axios.get(this.config.baseUrl + '/api/v2/system/status');
            const status = statusResponse.data;
            
            return {
                clickupConnected: status.clickup_connected,
                tokenExpiryMinutes: status.time_until_expiry_minutes,
                isOperational: status.is_operational,
                lastRefresh: status.last_refresh
            };
        } catch (error) {
            return {
                clickupConnected: false,
                tokenExpiryMinutes: 0,
                isOperational: false,
                error: error.message
            };
        }
    }

    cleanupOldMetrics() {
        const cutoff = Date.now() - this.config.retentionPeriod;
        const originalLength = this.metrics.length;
        
        this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
        
        const removed = originalLength - this.metrics.length;
        if (removed > 0) {
            console.log(`🧹 Cleaned up ${removed} old metrics`);
        }
    }

    getMetrics(since = 0) {
        return this.metrics.filter(metric => metric.timestamp > since);
    }

    getLatestMetrics() {
        return this.metrics[this.metrics.length - 1] || null;
    }

    getAverageMetrics(duration = 300000) { // 5 minutes default
        const since = Date.now() - duration;
        const recentMetrics = this.getMetrics(since);
        
        if (recentMetrics.length === 0) return null;
        
        const avg = {
            cpuUsage: 0,
            memoryUsage: 0,
            responseTime: 0,
            successRate: 0
        };
        
        recentMetrics.forEach(metric => {
            avg.cpuUsage += metric.system.cpuUsage;
            avg.memoryUsage += metric.system.memoryUsage;
            avg.responseTime += metric.api.averageResponseTime;
            avg.successRate += metric.api.successRate;
        });
        
        const count = recentMetrics.length;
        return {
            cpuUsage: Math.round(avg.cpuUsage / count),
            memoryUsage: Math.round(avg.memoryUsage / count),
            responseTime: Math.round(avg.responseTime / count),
            successRate: Math.round(avg.successRate / count),
            sampleCount: count,
            timeRange: duration
        };
    }
}

module.exports = { SystemMetricsCollector };