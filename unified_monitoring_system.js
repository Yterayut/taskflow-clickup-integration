/**
 * TaskFlow Pro - Unified Monitoring System
 * Consolidated system monitoring, metrics collection, and alerting
 */

const axios = require('axios');
const os = require('os');

class UnifiedMonitoringSystem {
    constructor(config = {}) {
        this.config = {
            backendUrl: config.backendUrl || 'http://192.168.20.10:7812',
            checkInterval: config.checkInterval || 30000,
            alertThresholds: {
                responseTime: 1000,
                errorRate: 5,
                memoryUsage: 80,
                cpuUsage: 80
            }
        };
        this.metrics = {};
        this.alerts = [];
        this.isRunning = false;
    }

    // Monitoring System
    async start() {
        if (this.isRunning) return;
        
        console.log('📊 Starting unified monitoring system...');
        this.isRunning = true;
        
        // Start periodic monitoring
        setInterval(() => {
            this.collectMetrics();
        }, this.config.checkInterval);
        
        return { status: 'Monitoring started', interval: this.config.checkInterval };
    }

    async stop() {
        this.isRunning = false;
        console.log('📊 Monitoring system stopped');
    }

    async collectMetrics() {
        try {
            const systemMetrics = await this.getSystemMetrics();
            const applicationMetrics = await this.getApplicationMetrics();
            const performanceMetrics = await this.getPerformanceMetrics();
            
            this.metrics = {
                system: systemMetrics,
                application: applicationMetrics,
                performance: performanceMetrics,
                timestamp: new Date().toISOString()
            };
            
            await this.checkAlerts();
            
        } catch (error) {
            console.error('Metrics collection failed:', error.message);
        }
    }

    async getSystemMetrics() {
        return {
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
            },
            cpu: {
                loadAverage: os.loadavg(),
                coreCount: os.cpus().length
            },
            uptime: os.uptime()
        };
    }

    async getApplicationMetrics() {
        try {
            const healthResponse = await axios.get(this.config.backendUrl + '/health', { timeout: 5000 });
            const statusResponse = await axios.get(this.config.backendUrl + '/api/v2/system/status', { timeout: 5000 });
            
            return {
                health: {
                    status: healthResponse.status,
                    responseTime: healthResponse.headers['x-response-time'] || 'N/A'
                },
                systemStatus: {
                    status: statusResponse.status,
                    data: statusResponse.data
                }
            };
        } catch (error) {
            return {
                health: { status: 'error', error: error.message },
                systemStatus: { status: 'error', error: error.message }
            };
        }
    }

    async getPerformanceMetrics() {
        const tests = [
            { name: 'API Health', url: '/health' },
            { name: 'System Status', url: '/api/v2/system/status' }
        ];
        
        const results = {};
        
        for (const test of tests) {
            try {
                const start = Date.now();
                await axios.get(this.config.backendUrl + test.url, { timeout: 5000 });
                results[test.name] = Date.now() - start;
            } catch (error) {
                results[test.name] = { error: error.message };
            }
        }
        
        return results;
    }

    async checkAlerts() {
        const newAlerts = [];
        
        // Check response time alerts
        Object.entries(this.metrics.performance || {}).forEach(([endpoint, time]) => {
            if (typeof time === 'number' && time > this.config.alertThresholds.responseTime) {
                newAlerts.push({
                    type: 'performance',
                    level: 'warning',
                    message: endpoint + ' response time: ' + time + 'ms',
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Check memory usage
        const memoryUsage = this.metrics.system?.memory?.usagePercent;
        if (memoryUsage && memoryUsage > this.config.alertThresholds.memoryUsage) {
            newAlerts.push({
                type: 'system',
                level: 'warning',
                message: 'High memory usage: ' + memoryUsage + '%',
                timestamp: new Date().toISOString()
            });
        }
        
        this.alerts.push(...newAlerts);
        
        // Keep only recent alerts (last 100)
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }
    }

    getMetrics() {
        return this.metrics;
    }

    getAlerts() {
        return this.alerts;
    }

    getHealthStatus() {
        const isHealthy = this.metrics.application?.health?.status === 200 &&
                         this.metrics.application?.systemStatus?.status === 200;
        
        return {
            healthy: isHealthy,
            lastCheck: this.metrics.timestamp,
            uptime: this.metrics.system?.uptime,
            alerts: this.alerts.length
        };
    }
}

module.exports = { UnifiedMonitoringSystem };