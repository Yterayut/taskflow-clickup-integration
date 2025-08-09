/**
 * Metrics API Endpoint
 * Provides monitoring data for dashboard and external systems
 */

const express = require('express');
const router = express.Router();

class MetricsAPI {
    constructor(metricsCollector, healthChecker, alertManager) {
        this.metricsCollector = metricsCollector;
        this.healthChecker = healthChecker;
        this.alertManager = alertManager;
    }

    setupRoutes() {
        // Current metrics endpoint
        router.get('/metrics', (req, res) => {
            try {
                const latest = this.metricsCollector.getLatestMetrics();
                const health = this.healthChecker.getHealthStatus();
                const alerts = this.alertManager.getAlertStats();
                
                res.json({
                    timestamp: Date.now(),
                    health: health.latest?.overall || 0,
                    responseTime: latest?.api?.averageResponseTime || 0,
                    cpuUsage: latest?.system?.cpuUsage || 0,
                    memoryUsage: latest?.system?.memoryUsage || 0,
                    successRate: latest?.api?.successRate || 0,
                    tokenMinutes: latest?.application?.tokenExpiryMinutes || 0,
                    alerts: alerts
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Historical metrics endpoint
        router.get('/metrics/history', (req, res) => {
            try {
                const since = parseInt(req.query.since) || (Date.now() - 3600000); // 1 hour default
                const metrics = this.metricsCollector.getMetrics(since);
                
                res.json({
                    since,
                    count: metrics.length,
                    metrics
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Health status endpoint
        router.get('/health', (req, res) => {
            try {
                const health = this.healthChecker.getHealthStatus();
                res.json(health);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Alerts endpoint
        router.get('/alerts', (req, res) => {
            try {
                const activeAlerts = this.alertManager.getActiveAlerts();
                res.json(activeAlerts);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Alert acknowledgment endpoint
        router.post('/alerts/:id/acknowledge', (req, res) => {
            try {
                const success = this.alertManager.acknowledgeAlert(req.params.id);
                res.json({ success });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Performance report endpoint
        router.get('/performance', (req, res) => {
            try {
                // This would integrate with PerformanceMonitor
                res.json({
                    message: 'Performance monitoring data',
                    timestamp: Date.now()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        return router;
    }
}

module.exports = { MetricsAPI };