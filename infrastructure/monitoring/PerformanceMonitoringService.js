/**
 * Performance Monitoring Service
 * TaskFlow Pro v2.2 - Comprehensive Performance Monitoring and Optimization
 */

const os = require('os');
const { performance } = require('perf_hooks');

class PerformanceMonitoringService {
    constructor({ 
        metricsRepository,
        auditLoggingService,
        alertingService 
    }) {
        this.metricsRepository = metricsRepository;
        this.auditLoggingService = auditLoggingService;
        this.alertingService = alertingService;
        
        // Performance thresholds
        this.thresholds = {
            responseTime: {
                warning: 500,    // 500ms
                critical: 1000   // 1 second
            },
            memoryUsage: {
                warning: 75,     // 75% of available memory
                critical: 90     // 90% of available memory
            },
            cpuUsage: {
                warning: 80,     // 80%
                critical: 95     // 95%
            },
            errorRate: {
                warning: 1,      // 1%
                critical: 5      // 5%
            },
            throughput: {
                warning: 10,     // Requests per second
                critical: 5      // Requests per second
            }
        };

        // Active monitoring data
        this.metrics = {
            requests: new Map(),
            errors: [],
            responseTime: [],
            memoryUsage: [],
            cpuUsage: [],
            activeConnections: 0,
            totalRequests: 0,
            totalErrors: 0
        };

        // Start system monitoring
        this.startSystemMonitoring();
    }

    /**
     * Start request monitoring
     */
    startRequest(requestId, endpoint, method, userId = null) {
        const startTime = performance.now();
        
        this.metrics.requests.set(requestId, {
            requestId,
            endpoint,
            method,
            userId,
            startTime,
            timestamp: new Date()
        });

        this.metrics.activeConnections++;
        this.metrics.totalRequests++;

        return {
            requestId,
            startTime
        };
    }

    /**
     * End request monitoring
     */
    endRequest(requestId, statusCode, responseSize = 0, errors = []) {
        const endTime = performance.now();
        const requestData = this.metrics.requests.get(requestId);
        
        if (!requestData) {
            console.warn(`Performance monitoring: Unknown request ID ${requestId}`);
            return null;
        }

        const responseTime = endTime - requestData.startTime;
        const isError = statusCode >= 400;

        // Update metrics
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
        this.metrics.responseTime.push({
            responseTime,
            endpoint: requestData.endpoint,
            timestamp: new Date()
        });

        if (isError) {
            this.metrics.totalErrors++;
            this.metrics.errors.push({
                requestId,
                endpoint: requestData.endpoint,
                statusCode,
                errors,
                responseTime,
                userId: requestData.userId,
                timestamp: new Date()
            });
        }

        // Check performance thresholds
        this.checkPerformanceThresholds(requestData, responseTime, statusCode);

        // Store detailed metrics
        const performanceData = {
            ...requestData,
            endTime,
            responseTime,
            statusCode,
            responseSize,
            isError,
            errors
        };

        // Clean up
        this.metrics.requests.delete(requestId);

        // Store in repository for historical analysis
        this.storeMetrics(performanceData);

        return performanceData;
    }

    /**
     * Start system resource monitoring
     */
    startSystemMonitoring() {
        // Monitor every 30 seconds
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);

        // Clean old metrics every 5 minutes
        setInterval(() => {
            this.cleanOldMetrics();
        }, 300000);
    }

    async collectSystemMetrics() {
        try {
            const memoryUsage = process.memoryUsage();
            const systemMemory = {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem()
            };

            const cpuUsage = await this.getCPUUsage();
            
            const systemMetrics = {
                timestamp: new Date(),
                memory: {
                    process: {
                        rss: memoryUsage.rss,
                        heapUsed: memoryUsage.heapUsed,
                        heapTotal: memoryUsage.heapTotal,
                        external: memoryUsage.external
                    },
                    system: systemMemory,
                    usagePercentage: (systemMemory.used / systemMemory.total) * 100
                },
                cpu: {
                    usage: cpuUsage,
                    loadAverage: os.loadavg(),
                    cores: os.cpus().length
                },
                connections: {
                    active: this.metrics.activeConnections,
                    total: this.metrics.totalRequests
                },
                uptime: process.uptime()
            };

            // Store metrics
            this.metrics.memoryUsage.push(systemMetrics.memory);
            this.metrics.cpuUsage.push(systemMetrics.cpu);

            // Check system thresholds
            this.checkSystemThresholds(systemMetrics);

            // Store in repository
            await this.metricsRepository.storeSystemMetrics(systemMetrics);

        } catch (error) {
            console.error('Error collecting system metrics:', error);
        }
    }

    async getCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();

            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);

                const totalTime = endTime[0] * 1000000 + endTime[1] / 1000; // microseconds
                const totalCpuTime = endUsage.user + endUsage.system; // microseconds

                const cpuPercent = (totalCpuTime / totalTime) * 100;
                resolve(Math.min(100, Math.max(0, cpuPercent)));
            }, 100);
        });
    }

    checkPerformanceThresholds(requestData, responseTime, statusCode) {
        const alerts = [];

        // Response time check
        if (responseTime > this.thresholds.responseTime.critical) {
            alerts.push({
                type: 'critical',
                metric: 'response_time',
                value: responseTime,
                threshold: this.thresholds.responseTime.critical,
                endpoint: requestData.endpoint
            });
        } else if (responseTime > this.thresholds.responseTime.warning) {
            alerts.push({
                type: 'warning',
                metric: 'response_time',
                value: responseTime,
                threshold: this.thresholds.responseTime.warning,
                endpoint: requestData.endpoint
            });
        }

        // Error rate check
        if (statusCode >= 400) {
            const recentErrors = this.getRecentErrorRate();
            if (recentErrors >= this.thresholds.errorRate.critical) {
                alerts.push({
                    type: 'critical',
                    metric: 'error_rate',
                    value: recentErrors,
                    threshold: this.thresholds.errorRate.critical,
                    endpoint: requestData.endpoint
                });
            } else if (recentErrors >= this.thresholds.errorRate.warning) {
                alerts.push({
                    type: 'warning',
                    metric: 'error_rate',
                    value: recentErrors,
                    threshold: this.thresholds.errorRate.warning,
                    endpoint: requestData.endpoint
                });
            }
        }

        // Send alerts if any
        if (alerts.length > 0) {
            this.sendPerformanceAlerts(alerts);
        }
    }

    checkSystemThresholds(systemMetrics) {
        const alerts = [];

        // Memory usage check
        if (systemMetrics.memory.usagePercentage > this.thresholds.memoryUsage.critical) {
            alerts.push({
                type: 'critical',
                metric: 'memory_usage',
                value: systemMetrics.memory.usagePercentage,
                threshold: this.thresholds.memoryUsage.critical
            });
        } else if (systemMetrics.memory.usagePercentage > this.thresholds.memoryUsage.warning) {
            alerts.push({
                type: 'warning',
                metric: 'memory_usage',
                value: systemMetrics.memory.usagePercentage,
                threshold: this.thresholds.memoryUsage.warning
            });
        }

        // CPU usage check
        if (systemMetrics.cpu.usage > this.thresholds.cpuUsage.critical) {
            alerts.push({
                type: 'critical',
                metric: 'cpu_usage',
                value: systemMetrics.cpu.usage,
                threshold: this.thresholds.cpuUsage.critical
            });
        } else if (systemMetrics.cpu.usage > this.thresholds.cpuUsage.warning) {
            alerts.push({
                type: 'warning',
                metric: 'cpu_usage',
                value: systemMetrics.cpu.usage,
                threshold: this.thresholds.cpuUsage.warning
            });
        }

        // Send alerts if any
        if (alerts.length > 0) {
            this.sendSystemAlerts(alerts);
        }
    }

    /**
     * Get comprehensive performance report
     */
    getPerformanceReport(timeRange = '1h') {
        const now = new Date();
        const cutoffTime = this.getTimeRangeCutoff(timeRange, now);

        // Filter recent data
        const recentResponseTimes = this.metrics.responseTime.filter(
            metric => metric.timestamp >= cutoffTime
        );
        const recentErrors = this.metrics.errors.filter(
            error => error.timestamp >= cutoffTime
        );

        // Calculate statistics
        const responseTimeStats = this.calculateStats(
            recentResponseTimes.map(metric => metric.responseTime)
        );

        const errorRate = this.metrics.totalRequests > 0 
            ? (recentErrors.length / this.metrics.totalRequests) * 100 
            : 0;

        const throughput = this.calculateThroughput(timeRange, this.metrics.totalRequests);

        // Get latest system metrics
        const latestMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        const latestCPU = this.metrics.cpuUsage[this.metrics.cpuUsage.length - 1];

        return {
            timestamp: now,
            timeRange,
            summary: {
                totalRequests: this.metrics.totalRequests,
                totalErrors: recentErrors.length,
                errorRate: Math.round(errorRate * 100) / 100,
                activeConnections: this.metrics.activeConnections,
                throughput: Math.round(throughput * 100) / 100
            },
            responseTime: {
                ...responseTimeStats,
                distribution: this.getResponseTimeDistribution(recentResponseTimes)
            },
            system: {
                memory: latestMemory || null,
                cpu: latestCPU || null,
                uptime: process.uptime()
            },
            topEndpoints: this.getTopEndpointsByResponseTime(recentResponseTimes),
            recentErrors: recentErrors.slice(-10), // Last 10 errors
            healthScore: this.calculateHealthScore(responseTimeStats, errorRate, latestMemory, latestCPU)
        };
    }

    /**
     * Get optimization recommendations
     */
    getOptimizationRecommendations() {
        const report = this.getPerformanceReport('1h');
        const recommendations = [];

        // Response time recommendations
        if (report.responseTime.average > this.thresholds.responseTime.warning) {
            recommendations.push({
                category: 'response_time',
                priority: report.responseTime.average > this.thresholds.responseTime.critical ? 'critical' : 'warning',
                issue: 'High average response time',
                recommendation: 'Consider implementing caching, database query optimization, or load balancing',
                currentValue: report.responseTime.average,
                targetValue: this.thresholds.responseTime.warning
            });
        }

        // Memory recommendations
        if (report.system.memory && report.system.memory.usagePercentage > this.thresholds.memoryUsage.warning) {
            recommendations.push({
                category: 'memory',
                priority: report.system.memory.usagePercentage > this.thresholds.memoryUsage.critical ? 'critical' : 'warning',
                issue: 'High memory usage',
                recommendation: 'Implement memory optimization, review for memory leaks, or increase available memory',
                currentValue: report.system.memory.usagePercentage,
                targetValue: this.thresholds.memoryUsage.warning
            });
        }

        // CPU recommendations
        if (report.system.cpu && report.system.cpu.usage > this.thresholds.cpuUsage.warning) {
            recommendations.push({
                category: 'cpu',
                priority: report.system.cpu.usage > this.thresholds.cpuUsage.critical ? 'critical' : 'warning',
                issue: 'High CPU usage',
                recommendation: 'Optimize CPU-intensive operations, implement async processing, or scale horizontally',
                currentValue: report.system.cpu.usage,
                targetValue: this.thresholds.cpuUsage.warning
            });
        }

        // Error rate recommendations
        if (report.summary.errorRate > this.thresholds.errorRate.warning) {
            recommendations.push({
                category: 'errors',
                priority: report.summary.errorRate > this.thresholds.errorRate.critical ? 'critical' : 'warning',
                issue: 'High error rate',
                recommendation: 'Review error logs, implement better error handling, and validate input data',
                currentValue: report.summary.errorRate,
                targetValue: this.thresholds.errorRate.warning
            });
        }

        // Throughput recommendations
        if (report.summary.throughput < this.thresholds.throughput.warning) {
            recommendations.push({
                category: 'throughput',
                priority: report.summary.throughput < this.thresholds.throughput.critical ? 'critical' : 'warning',
                issue: 'Low throughput',
                recommendation: 'Optimize database queries, implement connection pooling, and review bottlenecks',
                currentValue: report.summary.throughput,
                targetValue: this.thresholds.throughput.warning
            });
        }

        return {
            timestamp: new Date(),
            totalRecommendations: recommendations.length,
            criticalCount: recommendations.filter(r => r.priority === 'critical').length,
            warningCount: recommendations.filter(r => r.priority === 'warning').length,
            recommendations
        };
    }

    /**
     * Helper methods
     */
    getTimeRangeCutoff(timeRange, now) {
        const cutoffs = {
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000
        };

        const cutoffMs = cutoffs[timeRange] || cutoffs['1h'];
        return new Date(now.getTime() - cutoffMs);
    }

    calculateStats(values) {
        if (values.length === 0) {
            return { average: 0, min: 0, max: 0, median: 0, p95: 0, p99: 0 };
        }

        const sorted = values.sort((a, b) => a - b);
        const sum = values.reduce((acc, val) => acc + val, 0);

        return {
            average: Math.round(sum / values.length * 100) / 100,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: this.getPercentile(sorted, 50),
            p95: this.getPercentile(sorted, 95),
            p99: this.getPercentile(sorted, 99)
        };
    }

    getPercentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }

    getResponseTimeDistribution(responseTimeData) {
        const buckets = {
            '0-100ms': 0,
            '100-300ms': 0,
            '300-500ms': 0,
            '500ms-1s': 0,
            '1s+': 0
        };

        responseTimeData.forEach(metric => {
            const time = metric.responseTime;
            if (time <= 100) buckets['0-100ms']++;
            else if (time <= 300) buckets['100-300ms']++;
            else if (time <= 500) buckets['300-500ms']++;
            else if (time <= 1000) buckets['500ms-1s']++;
            else buckets['1s+']++;
        });

        return buckets;
    }

    getTopEndpointsByResponseTime(responseTimeData) {
        const endpointTimes = {};
        
        responseTimeData.forEach(metric => {
            if (!endpointTimes[metric.endpoint]) {
                endpointTimes[metric.endpoint] = [];
            }
            endpointTimes[metric.endpoint].push(metric.responseTime);
        });

        const endpointStats = Object.entries(endpointTimes)
            .map(([endpoint, times]) => ({
                endpoint,
                ...this.calculateStats(times),
                requestCount: times.length
            }))
            .sort((a, b) => b.average - a.average)
            .slice(0, 10);

        return endpointStats;
    }

    getRecentErrorRate() {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentErrors = this.metrics.errors.filter(error => error.timestamp >= fiveMinutesAgo);
        const recentRequests = Math.max(1, this.metrics.totalRequests); // Avoid division by zero
        
        return (recentErrors.length / recentRequests) * 100;
    }

    calculateThroughput(timeRange, totalRequests) {
        const timeRangeSeconds = {
            '5m': 5 * 60,
            '15m': 15 * 60,
            '1h': 60 * 60,
            '6h': 6 * 60 * 60,
            '24h': 24 * 60 * 60
        };

        const seconds = timeRangeSeconds[timeRange] || timeRangeSeconds['1h'];
        return totalRequests / seconds;
    }

    calculateHealthScore(responseTimeStats, errorRate, memoryMetrics, cpuMetrics) {
        let score = 100;

        // Response time impact (0-30 points)
        if (responseTimeStats.average > this.thresholds.responseTime.critical) {
            score -= 30;
        } else if (responseTimeStats.average > this.thresholds.responseTime.warning) {
            score -= 15;
        }

        // Error rate impact (0-25 points)
        if (errorRate > this.thresholds.errorRate.critical) {
            score -= 25;
        } else if (errorRate > this.thresholds.errorRate.warning) {
            score -= 12;
        }

        // Memory usage impact (0-25 points)
        if (memoryMetrics && memoryMetrics.usagePercentage > this.thresholds.memoryUsage.critical) {
            score -= 25;
        } else if (memoryMetrics && memoryMetrics.usagePercentage > this.thresholds.memoryUsage.warning) {
            score -= 12;
        }

        // CPU usage impact (0-20 points)
        if (cpuMetrics && cpuMetrics.usage > this.thresholds.cpuUsage.critical) {
            score -= 20;
        } else if (cpuMetrics && cpuMetrics.usage > this.thresholds.cpuUsage.warning) {
            score -= 10;
        }

        return Math.max(0, Math.round(score));
    }

    cleanOldMetrics() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Clean response time data
        this.metrics.responseTime = this.metrics.responseTime.filter(
            metric => metric.timestamp >= oneHourAgo
        );

        // Clean error data
        this.metrics.errors = this.metrics.errors.filter(
            error => error.timestamp >= oneHourAgo
        );

        // Keep only recent system metrics
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-120); // Last 2 hours of 30s intervals
        this.metrics.cpuUsage = this.metrics.cpuUsage.slice(-120);
    }

    async storeMetrics(performanceData) {
        try {
            if (this.metricsRepository) {
                await this.metricsRepository.storePerformanceMetrics(performanceData);
            }
        } catch (error) {
            console.error('Failed to store performance metrics:', error);
        }
    }

    async sendPerformanceAlerts(alerts) {
        try {
            if (this.alertingService) {
                await this.alertingService.sendPerformanceAlerts(alerts);
            }
            
            // Also log to audit service
            if (this.auditLoggingService) {
                await this.auditLoggingService.logEvent({
                    action: 'performance_alert_triggered',
                    details: { alerts },
                    riskLevel: alerts.some(a => a.type === 'critical') ? 'high' : 'medium'
                });
            }
        } catch (error) {
            console.error('Failed to send performance alerts:', error);
        }
    }

    async sendSystemAlerts(alerts) {
        try {
            if (this.alertingService) {
                await this.alertingService.sendSystemAlerts(alerts);
            }

            // Also log to audit service
            if (this.auditLoggingService) {
                await this.auditLoggingService.logEvent({
                    action: 'system_alert_triggered',
                    details: { alerts },
                    riskLevel: alerts.some(a => a.type === 'critical') ? 'high' : 'medium'
                });
            }
        } catch (error) {
            console.error('Failed to send system alerts:', error);
        }
    }
}

module.exports = { PerformanceMonitoringService };