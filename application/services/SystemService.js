/**
 * System Application Service
 * Manages system health, ClickUp token status, and operational readiness
 */
const { SystemStatus } = require('../../domain/value-objects/SystemStatus');
const { TokenRefreshError } = require('../errors/AuthenticationErrors');

class SystemService {
    constructor({
        tokenRepository,
        clickupIntegration,
        statusRepository,
        userRepository
    }) {
        this.tokenRepository = tokenRepository;
        this.clickupIntegration = clickupIntegration;
        this.statusRepository = statusRepository;
        this.userRepository = userRepository;
    }
    
    /**
     * Get current system operational status
     */
    async getStatus() {
        try {
            // Get master user's ClickUp token
            const clickupToken = await this.tokenRepository.findMasterToken();
            
            if (!clickupToken) {
                return SystemStatus.notOperational(
                    'ClickUp integration not configured. Master user must complete OAuth authentication.'
                );
            }
            
            // Check if token needs refresh or is expired
            if (clickupToken.isExpired()) {
                // Attempt auto-refresh if possible
                if (clickupToken.canAttemptRefresh()) {
                    try {
                        const newToken = await this.refreshClickUpToken(clickupToken);
                        await this.updateStatus({
                            clickup_connected: true,
                            last_token_refresh: new Date(),
                            master_token_expires_at: newToken.expiresAt
                        });
                        
                        return SystemStatus.operational(newToken.expiresAt, new Date());
                    } catch (refreshError) {
                        console.error('Auto-refresh failed:', refreshError);
                        
                        // Check if token is within grace period
                        if (clickupToken.isWithinGracePeriod()) {
                            await this.updateStatus({
                                clickup_connected: false,
                                last_token_refresh: null
                            });
                            
                            return new SystemStatus({
                                clickupConnected: false,
                                tokenExpiresAt: clickupToken.expiresAt,
                                lastHealthCheck: new Date(),
                                message: `ClickUp token expired but within grace period. System partially operational. Token refresh failed: ${refreshError.message}`
                            });
                        }
                    }
                }
                
                await this.updateStatus({
                    clickup_connected: false,
                    last_token_refresh: null
                });
                
                return SystemStatus.notOperational(
                    'ClickUp token expired and refresh failed. Master user needs to re-authenticate.'
                );
            }
            
            // Check if token needs refresh soon
            if (clickupToken.needsRefresh()) {
                // Attempt proactive refresh
                if (clickupToken.canAttemptRefresh()) {
                    try {
                        await this.refreshClickUpToken(clickupToken);
                    } catch (refreshError) {
                        console.warn('Proactive refresh failed:', refreshError);
                        // Continue with current token since it's not expired yet
                    }
                }
            }
            
            // Token is valid and operational
            await this.updateStatus({
                clickup_connected: true,
                master_token_expires_at: clickupToken.expiresAt
            });
            
            return SystemStatus.operational(clickupToken.expiresAt);
            
        } catch (error) {
            console.error('System status check error:', error);
            return SystemStatus.notOperational(`System status check failed: ${error.message}`);
        }
    }
    
    /**
     * Refresh ClickUp token
     */
    async refreshClickUpToken(clickupToken) {
        try {
            if (!clickupToken.refreshToken) {
                throw new TokenRefreshError('No refresh token available');
            }
            
            // Record refresh attempt
            clickupToken.recordFailedRefreshAttempt(); // Pre-record as failed, will reset if successful
            await this.tokenRepository.save(clickupToken);
            
            // Attempt refresh with ClickUp
            const newTokenData = await this.clickupIntegration.refreshToken(clickupToken.refreshToken);
            
            // Update token with new data
            clickupToken.updateFromRefresh({
                accessToken: newTokenData.access_token,
                refreshToken: newTokenData.refresh_token,
                expiresAt: new Date(Date.now() + (newTokenData.expires_in * 1000)),
                scope: newTokenData.scope
            });
            
            // Save updated token
            await this.tokenRepository.save(clickupToken);
            
            return clickupToken;
            
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw new TokenRefreshError(`Token refresh failed: ${error.message}`);
        }
    }
    
    /**
     * Update system status in database
     */
    async updateStatus(statusData) {
        try {
            await this.statusRepository.updateStatus({
                ...statusData,
                last_health_check: new Date()
            });
        } catch (error) {
            console.error('Failed to update system status:', error);
        }
    }
    
    /**
     * Get detailed system health metrics
     */
    async getHealthMetrics() {
        try {
            const systemStatus = await this.getStatus();
            const activeSessionCount = await this.getActiveSessionCount();
            const lastSuccessfulLogin = await this.getLastSuccessfulLogin();
            const failedLoginCount = await this.getFailedLoginCount24h();
            
            return {
                timestamp: new Date(),
                system_status: systemStatus.toApiResponse(),
                active_sessions: activeSessionCount,
                last_successful_login: lastSuccessfulLogin,
                failed_login_count_24h: failedLoginCount,
                database_status: await this.getDatabaseStatus()
            };
        } catch (error) {
            console.error('Health metrics error:', error);
            return {
                timestamp: new Date(),
                error: error.message,
                status: 'unhealthy'
            };
        }
    }
    
    /**
     * Force refresh of ClickUp token (manual trigger)
     */
    async forceRefreshToken() {
        const clickupToken = await this.tokenRepository.findMasterToken();
        
        if (!clickupToken) {
            throw new Error('No ClickUp token found');
        }
        
        const refreshedToken = await this.refreshClickUpToken(clickupToken);
        
        await this.updateStatus({
            clickup_connected: true,
            last_token_refresh: new Date(),
            master_token_expires_at: refreshedToken.expiresAt
        });
        
        return {
            success: true,
            message: 'Token refreshed successfully',
            expires_at: refreshedToken.expiresAt
        };
    }
    
    /**
     * Revoke ClickUp integration (emergency)
     */
    async revokeClickUpIntegration() {
        const clickupToken = await this.tokenRepository.findMasterToken();
        
        if (clickupToken) {
            clickupToken.revoke();
            await this.tokenRepository.save(clickupToken);
        }
        
        await this.updateStatus({
            clickup_connected: false,
            last_token_refresh: null,
            master_token_expires_at: null
        });
        
        return {
            success: true,
            message: 'ClickUp integration revoked'
        };
    }
    
    // Helper methods for health metrics
    async getActiveSessionCount() {
        // This would require session tracking implementation
        // For now, return 0 as placeholder
        return 0;
    }
    
    async getLastSuccessfulLogin() {
        try {
            const result = await this.userRepository.getLastSuccessfulLogin();
            return result?.last_login || null;
        } catch (error) {
            return null;
        }
    }
    
    async getFailedLoginCount24h() {
        // This would require login attempt tracking
        // For now, return 0 as placeholder
        return 0;
    }
    
    async getDatabaseStatus() {
        try {
            // Simple database health check
            await this.userRepository.healthCheck();
            return 'connected';
        } catch (error) {
            return 'disconnected';
        }
    }
}

module.exports = { SystemService };