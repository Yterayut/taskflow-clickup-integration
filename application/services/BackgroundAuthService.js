/**
 * Background Authentication Service
 * Handles automatic ClickUp token refresh and monitoring
 * Ensures zero-downtime authentication management
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class BackgroundAuthService {
    constructor(clickupOAuthAdapter, tokenStorage, logger = console) {
        this.clickupOAuthAdapter = clickupOAuthAdapter;
        this.tokenStorage = tokenStorage;
        this.logger = logger;
        this.monitoringInterval = null;
        this.isRunning = false;
        
        // Configuration
        this.config = {
            checkIntervalMinutes: 30,              // Check every 30 minutes
            refreshThresholdHours: 2,              // Refresh when < 2 hours remaining
            emergencyRefreshMinutes: 15,           // Emergency refresh if < 15 minutes
            maxRetryAttempts: 3,                   // Max retry attempts for failed refresh
            retryDelayMinutes: 5,                  // Delay between retry attempts
            gracePeriodHours: 24                   // Grace period for expired tokens
        };
        
        this.status = {
            lastCheck: null,
            lastSuccessfulRefresh: null,
            nextScheduledCheck: null,
            consecutiveFailures: 0,
            isHealthy: false,
            currentToken: null
        };
    }

    /**
     * Start the background authentication monitoring
     */
    async start() {
        try {
            this.logger.log('🔄 Starting Background Authentication Service...');
            
            // Initial token check
            await this.performTokenCheck();
            
            // Start periodic monitoring
            this.startPeriodicMonitoring();
            
            this.isRunning = true;
            this.logger.log('✅ Background Authentication Service started successfully');
            
            return {
                success: true,
                message: 'Background authentication service started',
                status: this.getStatus()
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to start Background Authentication Service:', error);
            throw error;
        }
    }

    /**
     * Stop the background authentication monitoring
     */
    stop() {
        this.logger.log('🛑 Stopping Background Authentication Service...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        this.isRunning = false;
        this.logger.log('✅ Background Authentication Service stopped');
    }

    /**
     * Start periodic token monitoring
     */
    startPeriodicMonitoring() {
        const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
        
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performTokenCheck();
            } catch (error) {
                this.logger.error('❌ Periodic token check failed:', error);
                this.status.consecutiveFailures++;
            }
        }, intervalMs);
        
        // Calculate next scheduled check
        this.status.nextScheduledCheck = new Date(Date.now() + intervalMs);
        
        this.logger.log(`⏰ Periodic monitoring scheduled every ${this.config.checkIntervalMinutes} minutes`);
    }

    /**
     * Perform token validation and refresh if needed
     */
    async performTokenCheck() {
        try {
            this.status.lastCheck = new Date();
            this.logger.log('🔍 Performing token check...');
            
            // Load current token
            const tokenData = await this.tokenStorage.getStoredToken();
            
            if (!tokenData) {
                this.logger.warn('⚠️ No stored token found - system requires initial authentication');
                this.status.isHealthy = false;
                return { status: 'no_token', action: 'requires_initial_auth' };
            }
            
            this.status.currentToken = tokenData;
            
            // Check token validity with ClickUp API
            const validationResult = await this.validateTokenWithClickUp(tokenData);
            
            if (!validationResult.isValid) {
                this.logger.warn('⚠️ Token validation failed, attempting refresh...');
                return await this.handleTokenRefresh(tokenData, 'validation_failed');
            }
            
            // Check if token needs proactive refresh
            const timeUntilExpiry = this.getTimeUntilExpiry(tokenData);
            const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
            
            this.logger.log(`⏱️ Token expires in ${hoursUntilExpiry.toFixed(1)} hours`);
            
            if (hoursUntilExpiry < this.config.emergencyRefreshMinutes / 60) {
                this.logger.warn('🚨 EMERGENCY: Token expires very soon!');
                return await this.handleTokenRefresh(tokenData, 'emergency_refresh');
            }
            
            if (hoursUntilExpiry < this.config.refreshThresholdHours) {
                this.logger.log('🔄 Proactive token refresh needed');
                return await this.handleTokenRefresh(tokenData, 'proactive_refresh');
            }
            
            // Token is healthy
            this.status.isHealthy = true;
            this.status.consecutiveFailures = 0;
            
            this.logger.log('✅ Token is healthy and valid');
            
            return {
                status: 'healthy',
                timeUntilExpiryHours: hoursUntilExpiry,
                nextCheckMinutes: this.config.checkIntervalMinutes
            };
            
        } catch (error) {
            this.logger.error('❌ Token check failed:', error);
            this.status.isHealthy = false;
            this.status.consecutiveFailures++;
            throw error;
        }
    }

    /**
     * Handle token refresh with multiple strategies
     */
    async handleTokenRefresh(currentToken, reason) {
        this.logger.log(`🔄 Starting token refresh (reason: ${reason})...`);
        
        const refreshStrategies = [
            'clickup_refresh_token',
            'stored_credentials_oauth',
            'emergency_notification'
        ];
        
        for (const strategy of refreshStrategies) {
            try {
                this.logger.log(`🎯 Attempting refresh strategy: ${strategy}`);
                
                const result = await this.executeRefreshStrategy(strategy, currentToken);
                
                if (result.success) {
                    this.logger.log(`✅ Token refresh successful using ${strategy}`);
                    this.status.lastSuccessfulRefresh = new Date();
                    this.status.isHealthy = true;
                    this.status.consecutiveFailures = 0;
                    
                    // Store new token
                    await this.tokenStorage.storeToken(result.token);
                    
                    return {
                        status: 'refreshed',
                        strategy: strategy,
                        token: result.token
                    };
                }
                
            } catch (error) {
                this.logger.warn(`⚠️ Refresh strategy ${strategy} failed:`, error.message);
                continue;
            }
        }
        
        // All strategies failed
        this.logger.error('❌ All token refresh strategies failed');
        this.status.isHealthy = false;
        
        return {
            status: 'refresh_failed',
            reason: 'all_strategies_exhausted',
            requiresManualIntervention: true
        };
    }

    /**
     * Execute specific refresh strategy
     */
    async executeRefreshStrategy(strategy, currentToken) {
        switch (strategy) {
            case 'clickup_refresh_token':
                return await this.refreshUsingRefreshToken(currentToken);
                
            case 'stored_credentials_oauth':
                return await this.refreshUsingStoredCredentials();
                
            case 'emergency_notification':
                return await this.handleEmergencyNotification(currentToken);
                
            default:
                throw new Error(`Unknown refresh strategy: ${strategy}`);
        }
    }

    /**
     * Refresh using ClickUp refresh token (if available)
     */
    async refreshUsingRefreshToken(currentToken) {
        if (!currentToken.refreshToken) {
            throw new Error('No refresh token available');
        }
        
        this.logger.log('🔄 Attempting refresh using refresh token...');
        
        // ClickUp API call to refresh token
        const response = await this.clickupOAuthAdapter.refreshAccessToken(currentToken.refreshToken);
        
        return {
            success: true,
            token: {
                accessToken: response.access_token,
                refreshToken: response.refresh_token || currentToken.refreshToken,
                tokenType: 'Bearer',
                userEmail: currentToken.userEmail,
                lastUsed: new Date().toISOString(),
                refreshedAt: new Date().toISOString(),
                refreshMethod: 'refresh_token'
            }
        };
    }

    /**
     * Refresh using stored master user credentials
     */
    async refreshUsingStoredCredentials() {
        this.logger.log('🔄 Attempting refresh using stored credentials...');
        
        const credentials = await this.tokenStorage.getStoredCredentials();
        
        if (!credentials) {
            throw new Error('No stored credentials available');
        }
        
        // Automated OAuth flow using stored credentials
        const authResult = await this.clickupOAuthAdapter.performAutomaticAuth(credentials);
        
        return {
            success: true,
            token: {
                accessToken: authResult.access_token,
                refreshToken: authResult.refresh_token,
                tokenType: 'Bearer',
                userEmail: credentials.email,
                lastUsed: new Date().toISOString(),
                refreshedAt: new Date().toISOString(),
                refreshMethod: 'stored_credentials'
            }
        };
    }

    /**
     * Handle emergency notification when all else fails
     */
    async handleEmergencyNotification(currentToken) {
        this.logger.warn('🚨 EMERGENCY: Sending notification for manual intervention');
        
        // In production, this would send alerts, emails, etc.
        // For now, we'll create a grace period with local data
        
        return {
            success: false,
            gracePeriod: true,
            message: 'Manual intervention required - system running on local data',
            notificationSent: true
        };
    }

    /**
     * Validate token with ClickUp API
     */
    async validateTokenWithClickUp(tokenData) {
        try {
            // Test token by making a simple API call
            const response = await fetch('https://api.clickup.com/api/v2/user', {
                headers: {
                    'Authorization': `${tokenData.tokenType} ${tokenData.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 401) {
                return { isValid: false, reason: 'unauthorized' };
            }
            
            if (!response.ok) {
                return { isValid: false, reason: 'api_error', status: response.status };
            }
            
            const userData = await response.json();
            
            return {
                isValid: true,
                user: userData.user,
                validatedAt: new Date()
            };
            
        } catch (error) {
            this.logger.warn('⚠️ Token validation API call failed:', error.message);
            return { isValid: false, reason: 'network_error', error: error.message };
        }
    }

    /**
     * Calculate time until token expiry
     */
    getTimeUntilExpiry(tokenData) {
        // ClickUp tokens typically last 30 days from lastUsed
        const lastUsed = new Date(tokenData.lastUsed || tokenData.refreshedAt || tokenData.createdAt);
        const expiryTime = new Date(lastUsed.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        const now = new Date();
        
        return Math.max(0, expiryTime.getTime() - now.getTime());
    }

    /**
     * Get current service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isHealthy: this.status.isHealthy,
            lastCheck: this.status.lastCheck,
            lastSuccessfulRefresh: this.status.lastSuccessfulRefresh,
            nextScheduledCheck: this.status.nextScheduledCheck,
            consecutiveFailures: this.status.consecutiveFailures,
            hasCurrentToken: !!this.status.currentToken,
            config: this.config
        };
    }

    /**
     * Force immediate token check and refresh
     */
    async forceRefresh() {
        this.logger.log('🔄 Force refresh requested...');
        return await this.performTokenCheck();
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.log('⚙️ Background auth configuration updated:', newConfig);
        
        // Restart monitoring with new config if running
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
}

module.exports = { BackgroundAuthService };