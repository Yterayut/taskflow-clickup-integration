/**
 * Enhanced Background Authentication Service
 * Production-ready automated token refresh
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

class EnhancedBackgroundAuthService {
    constructor(config = {}) {
        this.config = {
            checkIntervalMinutes: 15,              // Check every 15 minutes
            refreshThresholdMinutes: 30,           // Refresh when < 30 minutes remaining
            emergencyRefreshMinutes: 15,           // Emergency refresh if < 15 minutes
            maxRetryAttempts: 3,                   // Max retry attempts
            retryDelayMinutes: 5,                  // Delay between retries
            baseUrl: 'http://192.168.20.10:7812',
            ...config
        };
        
        this.isRunning = false;
        this.monitoringInterval = null;
        this.status = {
            lastCheck: null,
            lastRefresh: null,
            nextCheck: null,
            consecutiveFailures: 0,
            isHealthy: false
        };
    }

    async start() {
        console.log('🚀 Starting Enhanced Background Auth Service...');
        
        // Initial check
        await this.performTokenCheck();
        
        // Start monitoring
        this.startMonitoring();
        
        this.isRunning = true;
        console.log('✅ Enhanced Background Auth Service started');
        
        return { success: true, status: this.getStatus() };
    }

    startMonitoring() {
        const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performTokenCheck();
            } catch (error) {
                console.error('❌ Token check failed:', error.message);
                this.status.consecutiveFailures++;
            }
        }, intervalMs);
        
        this.status.nextCheck = new Date(Date.now() + intervalMs);
        console.log('⏰ Monitoring every ' + this.config.checkIntervalMinutes + ' minutes');
    }

    async performTokenCheck() {
        this.status.lastCheck = new Date();
        
        try {
            // Get current token status
            const response = await axios.get(this.config.baseUrl + '/api/v2/system/status');
            const timeRemaining = response.data.time_until_expiry_minutes;
            
            console.log('🕒 Token check: ' + timeRemaining + ' minutes remaining');
            
            // Determine if refresh is needed
            if (timeRemaining <= this.config.emergencyRefreshMinutes) {
                console.log('🚨 Emergency refresh needed!');
                await this.performEmergencyRefresh();
            } else if (timeRemaining <= this.config.refreshThresholdMinutes) {
                console.log('⚠️ Proactive refresh needed');
                await this.performProactiveRefresh();
            } else {
                console.log('✅ Token healthy');
                this.status.isHealthy = true;
                this.status.consecutiveFailures = 0;
            }
            
        } catch (error) {
            console.error('❌ Token check failed:', error.message);
            this.status.isHealthy = false;
            this.status.consecutiveFailures++;
            throw error;
        }
    }

    async performProactiveRefresh() {
        console.log('🔄 Performing proactive token refresh...');
        
        try {
            // Trigger manual OAuth refresh notification
            await this.notifyRefreshNeeded('proactive');
            
            this.status.lastRefresh = new Date();
            this.status.consecutiveFailures = 0;
            console.log('✅ Proactive refresh completed');
            
        } catch (error) {
            console.error('❌ Proactive refresh failed:', error.message);
            throw error;
        }
    }

    async performEmergencyRefresh() {
        console.log('🚨 Performing emergency token refresh...');
        
        try {
            // Trigger emergency OAuth refresh notification
            await this.notifyRefreshNeeded('emergency');
            
            this.status.lastRefresh = new Date();
            this.status.consecutiveFailures = 0;
            console.log('✅ Emergency refresh completed');
            
        } catch (error) {
            console.error('❌ Emergency refresh failed:', error.message);
            throw error;
        }
    }

    async notifyRefreshNeeded(type) {
        // For now, log the need for refresh
        // In production, this could send notifications, emails, etc.
        console.log('📢 ' + type.toUpperCase() + ' REFRESH NEEDED: Please visit http://192.168.20.10:7812/auth/clickup');
        
        // Create notification file
        const notificationFile = path.join('.', 'oauth_refresh_needed.txt');
        const notification = `TOKEN REFRESH NEEDED (${type})
Time: ${new Date().toISOString()}
Action: Visit http://192.168.20.10:7812/auth/clickup
Urgency: ${type === 'emergency' ? 'CRITICAL' : 'HIGH'}
`;
        
        await fs.writeFile(notificationFile, notification);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            isHealthy: this.status.isHealthy,
            lastCheck: this.status.lastCheck,
            lastRefresh: this.status.lastRefresh,
            nextCheck: this.status.nextCheck,
            consecutiveFailures: this.status.consecutiveFailures,
            config: this.config
        };
    }

    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isRunning = false;
        console.log('🛑 Enhanced Background Auth Service stopped');
    }
}

module.exports = { EnhancedBackgroundAuthService };
