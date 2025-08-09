/**
 * Health Checker
 * Comprehensive system health monitoring and diagnostics
 */

const axios = require('axios');

class HealthChecker {
    constructor(config = {}) {
        this.config = {
            baseUrl: 'http://192.168.20.10:7812',
            checkInterval: 30000, // 30 seconds
            timeout: 5000,
            ...config
        };
        
        this.healthHistory = [];
        this.isChecking = false;
        this.currentStatus = 'unknown';
    }

    start() {
        if (this.isChecking) return;
        
        console.log('🏥 Starting Health Checker...');
        this.isChecking = true;
        
        // Initial health check
        this.performHealthCheck();
        
        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.checkInterval);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isChecking = false;
        console.log('🛑 Health Checker stopped');
    }

    async performHealthCheck() {
        try {
            const timestamp = Date.now();
            const checks = await this.runAllHealthChecks();
            
            const healthReport = {
                timestamp,
                overall: this.calculateOverallHealth(checks),
                checks,
                status: this.determineStatus(checks),
                uptime: this.calculateUptime(checks)
            };
            
            this.healthHistory.push(healthReport);
            this.currentStatus = healthReport.status;
            
            // Keep only last 24 hours
            const cutoff = timestamp - (24 * 60 * 60 * 1000);
            this.healthHistory = this.healthHistory.filter(h => h.timestamp > cutoff);
            
            // Log health status
            const statusIcon = healthReport.status === 'healthy' ? '✅' : 
                              healthReport.status === 'degraded' ? '⚠️' : '❌';
            
            console.log(`🏥 Health Check - ${statusIcon} ${healthReport.status.toUpperCase()} (Score: ${healthReport.overall}/100)`);
            
            // Alert on unhealthy status
            if (healthReport.status === 'unhealthy') {
                console.error('🚨 SYSTEM UNHEALTHY - Immediate attention required!');
                const failedChecks = checks.filter(check => !check.success);
                failedChecks.forEach(check => {
                    console.error(`   ❌ ${check.name}: ${check.error}`);
                });
            }
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
        }
    }

    async runAllHealthChecks() {
        const checks = [
            { name: 'Backend API', test: () => this.checkBackendHealth() },
            { name: 'Frontend', test: () => this.checkFrontendHealth() },
            { name: 'Database Connection', test: () => this.checkDatabaseHealth() },
            { name: 'Authentication', test: () => this.checkAuthHealth() },
            { name: 'OAuth Token', test: () => this.checkTokenHealth() },
            { name: 'System Resources', test: () => this.checkSystemResources() }
        ];
        
        const results = [];
        
        for (const check of checks) {
            try {
                const start = Date.now();
                const result = await check.test();
                const duration = Date.now() - start;
                
                results.push({
                    name: check.name,
                    success: true,
                    duration,
                    ...result
                });
            } catch (error) {
                results.push({
                    name: check.name,
                    success: false,
                    error: error.message,
                    duration: null
                });
            }
        }
        
        return results;
    }

    async checkBackendHealth() {
        const response = await axios.get(this.config.baseUrl + '/health', {
            timeout: this.config.timeout
        });
        
        return {
            status: response.status,
            version: response.data.version,
            uptime: response.data.uptime_seconds
        };
    }

    async checkFrontendHealth() {
        const response = await axios.get('http://192.168.20.10:8888/', {
            timeout: this.config.timeout
        });
        
        return {
            status: response.status,
            contentLength: response.data.length
        };
    }

    async checkDatabaseHealth() {
        const response = await axios.get(this.config.baseUrl + '/api/v2/local/dashboard-data', {
            timeout: this.config.timeout
        });
        
        const data = response.data;
        return {
            status: response.status,
            success: data.success,
            dataAvailable: data.data && Object.keys(data.data).length > 0
        };
    }

    async checkAuthHealth() {
        try {
            await axios.get(this.config.baseUrl + '/api/v2/auth/profile', {
                timeout: this.config.timeout
            });
            // If we get here without 401, auth might not be working
            return { protected: false, warning: 'Auth endpoint not protected' };
        } catch (error) {
            if (error.response?.status === 401) {
                return { protected: true, status: 'working' };
            }
            throw error;
        }
    }

    async checkTokenHealth() {
        const response = await axios.get(this.config.baseUrl + '/api/v2/system/status', {
            timeout: this.config.timeout
        });
        
        const status = response.data;
        return {
            connected: status.clickup_connected,
            expiryMinutes: status.time_until_expiry_minutes,
            operational: status.is_operational,
            critical: status.time_until_expiry_minutes < 30
        };
    }

    async checkSystemResources() {
        // This would typically check system resources
        // For now, return mock healthy status
        return {
            cpuOk: true,
            memoryOk: true,
            diskOk: true
        };
    }

    calculateOverallHealth(checks) {
        const successfulChecks = checks.filter(check => check.success).length;
        const totalChecks = checks.length;
        
        return Math.round((successfulChecks / totalChecks) * 100);
    }

    determineStatus(checks) {
        const healthScore = this.calculateOverallHealth(checks);
        
        if (healthScore >= 90) return 'healthy';
        if (healthScore >= 70) return 'degraded';
        return 'unhealthy';
    }

    calculateUptime(checks) {
        const backendCheck = checks.find(check => check.name === 'Backend API');
        return backendCheck?.uptime || 0;
    }

    getHealthStatus() {
        return {
            current: this.currentStatus,
            latest: this.healthHistory[this.healthHistory.length - 1],
            history: this.healthHistory.slice(-10) // Last 10 checks
        };
    }

    getHealthTrend() {
        if (this.healthHistory.length < 5) return 'insufficient_data';
        
        const recent = this.healthHistory.slice(-5);
        const scores = recent.map(h => h.overall);
        
        const avgRecent = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const avgOlder = this.healthHistory.slice(-10, -5).reduce((sum, h) => sum + h.overall, 0) / 5;
        
        if (avgRecent > avgOlder + 10) return 'improving';
        if (avgRecent < avgOlder - 10) return 'degrading';
        return 'stable';
    }
}

module.exports = { HealthChecker };