/**
 * Alert Manager
 * Intelligent alerting system with escalation and notification
 */

const fs = require('fs').promises;

class AlertManager {
    constructor(config = {}) {
        this.config = {
            alertFile: 'alerts.log',
            escalationDelays: {
                low: 3600000,    // 1 hour
                medium: 1800000, // 30 minutes
                high: 900000,    // 15 minutes
                critical: 300000 // 5 minutes
            },
            maxAlerts: 1000,
            ...config
        };
        
        this.activeAlerts = new Map();
        this.alertHistory = [];
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        
        console.log('🚨 Starting Alert Manager...');
        this.isRunning = true;
        
        // Process alerts every minute
        this.processingInterval = setInterval(() => {
            this.processAlerts();
        }, 60000);
    }

    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 Alert Manager stopped');
    }

    async createAlert(type, severity, message, details = {}) {
        const alert = {
            id: this.generateAlertId(),
            type,
            severity,
            message,
            details,
            timestamp: Date.now(),
            status: 'active',
            escalated: false,
            acknowledged: false,
            resolved: false
        };
        
        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.push(alert);
        
        // Keep history under limit
        if (this.alertHistory.length > this.config.maxAlerts) {
            this.alertHistory.shift();
        }
        
        // Log alert
        await this.logAlert(alert);
        
        // Immediate notification for critical alerts
        if (severity === 'critical') {
            this.sendImmediateNotification(alert);
        }
        
        console.log(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`);
        
        return alert.id;
    }

    async resolveAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) return false;
        
        alert.status = 'resolved';
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        
        this.activeAlerts.delete(alertId);
        
        await this.logAlert(alert, 'RESOLVED');
        console.log(`✅ Alert resolved: ${alert.message}`);
        
        return true;
    }

    async acknowledgeAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) return false;
        
        alert.acknowledged = true;
        alert.acknowledgedAt = Date.now();
        
        await this.logAlert(alert, 'ACKNOWLEDGED');
        console.log(`👍 Alert acknowledged: ${alert.message}`);
        
        return true;
    }

    processAlerts() {
        const now = Date.now();
        
        for (const [alertId, alert] of this.activeAlerts) {
            if (alert.acknowledged) continue;
            
            const age = now - alert.timestamp;
            const escalationDelay = this.config.escalationDelays[alert.severity];
            
            if (age > escalationDelay && !alert.escalated) {
                this.escalateAlert(alert);
            }
        }
    }

    async escalateAlert(alert) {
        alert.escalated = true;
        alert.escalatedAt = Date.now();
        
        console.warn(`⬆️ ESCALATING ALERT: ${alert.message}`);
        
        // Log escalation
        await this.logAlert(alert, 'ESCALATED');
        
        // Send escalation notification
        this.sendEscalationNotification(alert);
    }

    async logAlert(alert, action = 'CREATED') {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                action,
                alert: {
                    id: alert.id,
                    type: alert.type,
                    severity: alert.severity,
                    message: alert.message,
                    details: alert.details
                }
            };
            
            await fs.appendFile(this.config.alertFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Failed to log alert:', error.message);
        }
    }

    sendImmediateNotification(alert) {
        // In a real implementation, this would send email, SMS, Slack, etc.
        console.log(`📢 IMMEDIATE NOTIFICATION: ${alert.message}`);
        console.log('   Details:', JSON.stringify(alert.details, null, 2));
    }

    sendEscalationNotification(alert) {
        console.log(`📢 ESCALATION NOTIFICATION: ${alert.message}`);
        console.log('   Alert has been escalated due to lack of acknowledgment');
    }

    generateAlertId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getActiveAlerts() {
        return Array.from(this.activeAlerts.values());
    }

    getAlertHistory(since = 0) {
        return this.alertHistory.filter(alert => alert.timestamp > since);
    }

    getAlertStats() {
        const now = Date.now();
        const lastHour = now - 3600000;
        const lastDay = now - 86400000;
        
        const hourlyAlerts = this.alertHistory.filter(a => a.timestamp > lastHour);
        const dailyAlerts = this.alertHistory.filter(a => a.timestamp > lastDay);
        
        return {
            active: this.activeAlerts.size,
            lastHour: hourlyAlerts.length,
            lastDay: dailyAlerts.length,
            bySeverity: {
                critical: hourlyAlerts.filter(a => a.severity === 'critical').length,
                high: hourlyAlerts.filter(a => a.severity === 'high').length,
                medium: hourlyAlerts.filter(a => a.severity === 'medium').length,
                low: hourlyAlerts.filter(a => a.severity === 'low').length
            }
        };
    }
}

module.exports = { AlertManager };