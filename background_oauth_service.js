/**
 * Background OAuth Service
 * TaskFlow Pro v2.2 - Independent OAuth Token Management Service
 * Handles auto-refresh, keep-alive, and data sync operations
 */

require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');

class BackgroundOAuthService {
    constructor() {
        this.isRunning = false;
        this.refreshInterval = null;
        this.keepAliveInterval = null;
        this.syncInterval = null;
        this.emailTransporter = null;
        
        // Configuration
        this.config = {
            refreshIntervalMinutes: 55, // Refresh every 55 minutes
            keepAliveIntervalSeconds: 30, // Keep alive every 30 seconds
            syncIntervalMinutes: 5, // Data sync every 5 minutes
            maxRetries: 3,
            retryDelay: 5000,
            emailAlerts: process.env.EMAIL_ALERTS_ENABLED === 'true'
        };

        this.initializeEmailTransporter();
    }

    initializeEmailTransporter() {
        if (this.config.emailAlerts) {
            this.emailTransporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('Background OAuth Service already running');
            return;
        }

        console.log('Starting Background OAuth Service...');
        this.isRunning = true;

        try {
            // Initial token validation
            await this.validateAndRefreshTokens();

            // Start periodic tasks
            this.startTokenRefreshSchedule();
            this.startKeepAliveSchedule();
            this.startDataSyncSchedule();

            console.log('Background OAuth Service started successfully');
            
            if (this.config.emailAlerts) {
                await this.sendAlert('service_started', 'Background OAuth Service started successfully');
            }
        } catch (error) {
            console.error('Failed to start Background OAuth Service:', error);
            this.isRunning = false;
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) {
            console.log('Background OAuth Service not running');
            return;
        }

        console.log('Stopping Background OAuth Service...');
        
        // Clear intervals
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        if (this.syncInterval) clearInterval(this.syncInterval);

        this.isRunning = false;
        console.log('Background OAuth Service stopped');
    }

    startTokenRefreshSchedule() {
        const intervalMs = this.config.refreshIntervalMinutes * 60 * 1000;
        
        this.refreshInterval = setInterval(async () => {
            try {
                await this.validateAndRefreshTokens();
                console.log(`[${new Date().toISOString()}] Token refresh completed`);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Token refresh failed:`, error);
                await this.handleError('token_refresh_failed', error);
            }
        }, intervalMs);

        console.log(`Token refresh scheduled every ${this.config.refreshIntervalMinutes} minutes`);
    }

    startKeepAliveSchedule() {
        const intervalMs = this.config.keepAliveIntervalSeconds * 1000;
        
        this.keepAliveInterval = setInterval(async () => {
            try {
                await this.performKeepAliveCheck();
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Keep-alive check failed:`, error);
                // Keep-alive failures are less critical, log but continue
            }
        }, intervalMs);

        console.log(`Keep-alive checks scheduled every ${this.config.keepAliveIntervalSeconds} seconds`);
    }

    startDataSyncSchedule() {
        const intervalMs = this.config.syncIntervalMinutes * 60 * 1000;
        
        this.syncInterval = setInterval(async () => {
            try {
                await this.performDataSync();
                console.log(`[${new Date().toISOString()}] Data sync completed`);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Data sync failed:`, error);
                await this.handleError('data_sync_failed', error);
            }
        }, intervalMs);

        console.log(`Data sync scheduled every ${this.config.syncIntervalMinutes} minutes`);
    }

    async validateAndRefreshTokens() {
        try {
            const response = await this.makeBackendRequest('GET', '/api/v2/oauth/validate-token');
            
            if (!response.data.valid) {
                console.log('Token invalid, attempting refresh...');
                await this.refreshOAuthToken();
            } else {
                console.log('Token validation successful');
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            await this.refreshOAuthToken();
        }
    }

    async refreshOAuthToken() {
        let retries = 0;
        
        while (retries < this.config.maxRetries) {
            try {
                const response = await this.makeBackendRequest('POST', '/api/v2/oauth/refresh');
                
                if (response.data.success) {
                    console.log('OAuth token refreshed successfully');
                    return;
                } else {
                    throw new Error('Token refresh response indicated failure');
                }
            } catch (error) {
                retries++;
                console.error(`Token refresh attempt ${retries} failed:`, error.message);
                
                if (retries >= this.config.maxRetries) {
                    throw new Error(`Token refresh failed after ${this.config.maxRetries} attempts`);
                }
                
                await this.delay(this.config.retryDelay * retries);
            }
        }
    }

    async performKeepAliveCheck() {
        try {
            const response = await this.makeBackendRequest('GET', '/health');
            
            if (response.data.status === 'OK') {
                // System is alive
                return;
            } else {
                throw new Error('Health check returned non-OK status');
            }
        } catch (error) {
            console.error('Keep-alive check failed:', error.message);
            // Try to wake up the service
            await this.attemptServiceWakeup();
        }
    }

    async attemptServiceWakeup() {
        try {
            console.log('Attempting to wake up backend service...');
            await this.makeBackendRequest('GET', '/api/v2/system/ping');
            console.log('Service wakeup successful');
        } catch (error) {
            console.error('Service wakeup failed:', error.message);
            await this.handleError('service_wakeup_failed', error);
        }
    }

    async performDataSync() {
        try {
            // Check if sync is needed
            const syncStatus = await this.makeBackendRequest('GET', '/api/v2/local/sync-status');
            
            if (syncStatus.data.needsSync || this.shouldForceSync(syncStatus.data)) {
                console.log('Initiating data sync...');
                const syncResponse = await this.makeBackendRequest('POST', '/api/v2/local/force-sync');
                
                if (syncResponse.data.success) {
                    console.log(`Data sync completed: ${syncResponse.data.message}`);
                } else {
                    throw new Error('Sync response indicated failure');
                }
            } else {
                console.log('Data sync not needed, skipping...');
            }
        } catch (error) {
            console.error('Data sync failed:', error.message);
            throw error;
        }
    }

    shouldForceSync(syncStatus) {
        // Force sync if last sync was more than 2 hours ago
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const lastSync = new Date(syncStatus.lastSync);
        return lastSync < twoHoursAgo;
    }

    async makeBackendRequest(method, path, data = null) {
        const baseURL = process.env.BACKEND_URL || 'http://localhost:7812';
        const url = `${baseURL}${path}`;

        const config = {
            method,
            url,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-Background-OAuth-Service/2.2'
            }
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return response;
        } catch (error) {
            if (error.response) {
                throw new Error(`Backend request failed: ${error.response.status} ${error.response.statusText}`);
            } else if (error.request) {
                throw new Error('Backend request failed: No response received');
            } else {
                throw new Error(`Backend request failed: ${error.message}`);
            }
        }
    }

    async handleError(errorType, error) {
        const errorInfo = {
            type: errorType,
            message: error.message,
            timestamp: new Date().toISOString(),
            service: 'Background OAuth Service'
        };

        console.error('Service error:', errorInfo);

        // Log error to backend if possible
        try {
            await this.makeBackendRequest('POST', '/api/v2/system/log-error', errorInfo);
        } catch (logError) {
            console.error('Failed to log error to backend:', logError.message);
        }

        // Send email alert for critical errors
        if (this.config.emailAlerts && this.isCriticalError(errorType)) {
            await this.sendAlert(errorType, error.message);
        }

        // Implement recovery strategies
        await this.attemptErrorRecovery(errorType, error);
    }

    isCriticalError(errorType) {
        const criticalErrors = [
            'token_refresh_failed',
            'service_wakeup_failed',
            'data_sync_failed'
        ];
        return criticalErrors.includes(errorType);
    }

    async attemptErrorRecovery(errorType, error) {
        switch (errorType) {
            case 'token_refresh_failed':
                // Try to re-authenticate
                await this.delay(60000); // Wait 1 minute
                try {
                    await this.validateAndRefreshTokens();
                    console.log('Error recovery successful: token refresh recovered');
                } catch (recoveryError) {
                    console.error('Error recovery failed:', recoveryError.message);
                }
                break;
            
            case 'service_wakeup_failed':
                // Try to restart connection checks
                await this.delay(30000); // Wait 30 seconds
                try {
                    await this.performKeepAliveCheck();
                    console.log('Error recovery successful: service connection recovered');
                } catch (recoveryError) {
                    console.error('Error recovery failed:', recoveryError.message);
                }
                break;
            
            case 'data_sync_failed':
                // Try sync again after delay
                await this.delay(300000); // Wait 5 minutes
                try {
                    await this.performDataSync();
                    console.log('Error recovery successful: data sync recovered');
                } catch (recoveryError) {
                    console.error('Error recovery failed:', recoveryError.message);
                }
                break;
        }
    }

    async sendAlert(alertType, message) {
        if (!this.emailTransporter || !process.env.ALERT_EMAIL) {
            return;
        }

        const emailContent = {
            from: process.env.SMTP_USER,
            to: process.env.ALERT_EMAIL,
            subject: `TaskFlow Alert: ${alertType}`,
            text: `
TaskFlow Background OAuth Service Alert

Type: ${alertType}
Message: ${message}
Timestamp: ${new Date().toISOString()}
Service: Background OAuth Service v2.2

This is an automated alert from the TaskFlow Pro system.
            `,
            html: `
<h2>TaskFlow Background OAuth Service Alert</h2>
<p><strong>Type:</strong> ${alertType}</p>
<p><strong>Message:</strong> ${message}</p>
<p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
<p><strong>Service:</strong> Background OAuth Service v2.2</p>
<hr>
<p><em>This is an automated alert from the TaskFlow Pro system.</em></p>
            `
        };

        try {
            await this.emailTransporter.sendMail(emailContent);
            console.log(`Alert email sent for: ${alertType}`);
        } catch (emailError) {
            console.error('Failed to send alert email:', emailError.message);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config,
            uptime: this.isRunning ? Date.now() - this.startTime : 0,
            lastHealthCheck: this.lastHealthCheck,
            emailAlertsEnabled: this.config.emailAlerts
        };
    }
}

// Main execution
async function main() {
    const service = new BackgroundOAuthService();
    
    // Graceful shutdown handling
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await service.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await service.stop();
        process.exit(0);
    });

    try {
        await service.start();
        
        // Keep the process running
        console.log('Background OAuth Service is running. Press Ctrl+C to stop.');
        
        // Prevent the process from exiting
        setInterval(() => {
            // Health check logging
            if (service.isRunning) {
                console.log(`[${new Date().toISOString()}] Service status: Running`);
            }
        }, 300000); // Log status every 5 minutes
        
    } catch (error) {
        console.error('Failed to start Background OAuth Service:', error);
        process.exit(1);
    }
}

// Start the service if this file is run directly
if (require.main === module) {
    main();
}

module.exports = { BackgroundOAuthService };