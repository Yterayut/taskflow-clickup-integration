/**
 * Notification System
 * Handles delivery of alerts through various channels
 */

const fs = require('fs').promises;

class NotificationSystem {
    constructor(config = {}) {
        this.config = {
            channels: ['console', 'log', 'file'],
            logFile: 'notifications.log',
            ...config
        };
        
        this.notificationHistory = [];
    }

    async sendNotification(alert, channel = 'all') {
        const notification = {
            id: this.generateNotificationId(),
            alertId: alert.id,
            timestamp: Date.now(),
            channel,
            alert,
            status: 'sent'
        };

        try {
            if (channel === 'all') {
                // Send to all configured channels
                for (const ch of this.config.channels) {
                    await this.sendToChannel(alert, ch);
                }
            } else {
                await this.sendToChannel(alert, channel);
            }

            this.notificationHistory.push(notification);
            
            // Keep only last 1000 notifications
            if (this.notificationHistory.length > 1000) {
                this.notificationHistory.shift();
            }

        } catch (error) {
            notification.status = 'failed';
            notification.error = error.message;
            console.error('Notification failed:', error.message);
        }

        return notification;
    }

    async sendToChannel(alert, channel) {
        switch (channel) {
            case 'console':
                this.sendToConsole(alert);
                break;
            case 'log':
                await this.sendToLog(alert);
                break;
            case 'file':
                await this.sendToFile(alert);
                break;
            case 'email':
                await this.sendToEmail(alert);
                break;
            case 'slack':
                await this.sendToSlack(alert);
                break;
            default:
                throw new Error(`Unknown notification channel: ${channel}`);
        }
    }

    sendToConsole(alert) {
        const icon = this.getSeverityIcon(alert.severity);
        const timestamp = new Date().toLocaleString();
        
        console.log(`${icon} [${timestamp}] ${alert.severity.toUpperCase()}: ${alert.message}`);
        if (alert.details) {
            console.log('   Details:', JSON.stringify(alert.details, null, 2));
        }
    }

    async sendToLog(alert) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: alert.severity.toUpperCase(),
            message: alert.message,
            details: alert.details,
            alertId: alert.id
        };

        await fs.appendFile(this.config.logFile, JSON.stringify(logEntry) + '\n');
    }

    async sendToFile(alert) {
        const fileName = `alert_${alert.severity}_${Date.now()}.json`;
        const alertData = {
            ...alert,
            notificationTime: new Date().toISOString()
        };

        await fs.writeFile(fileName, JSON.stringify(alertData, null, 2));
    }

    async sendToEmail(alert) {
        // Mock email implementation
        console.log(`📧 EMAIL NOTIFICATION: ${alert.message}`);
        console.log('   (Email functionality would be implemented here)');
    }

    async sendToSlack(alert) {
        // Mock Slack implementation
        console.log(`💬 SLACK NOTIFICATION: ${alert.message}`);
        console.log('   (Slack integration would be implemented here)');
    }

    getSeverityIcon(severity) {
        const icons = {
            critical: '🚨',
            high: '⚠️',
            medium: '⚡',
            low: 'ℹ️'
        };
        return icons[severity] || '📢';
    }

    generateNotificationId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getNotificationHistory(since = 0) {
        return this.notificationHistory.filter(n => n.timestamp > since);
    }

    getNotificationStats() {
        const now = Date.now();
        const lastHour = now - 3600000;
        
        const recentNotifications = this.notificationHistory.filter(n => n.timestamp > lastHour);
        
        return {
            total: this.notificationHistory.length,
            lastHour: recentNotifications.length,
            byChannel: this.groupByChannel(recentNotifications),
            bySeverity: this.groupBySeverity(recentNotifications)
        };
    }

    groupByChannel(notifications) {
        return notifications.reduce((acc, notification) => {
            acc[notification.channel] = (acc[notification.channel] || 0) + 1;
            return acc;
        }, {});
    }

    groupBySeverity(notifications) {
        return notifications.reduce((acc, notification) => {
            const severity = notification.alert.severity;
            acc[severity] = (acc[severity] || 0) + 1;
            return acc;
        }, {});
    }
}

module.exports = { NotificationSystem };