/**
 * Master User Token Management Routes
 * Specialized endpoints for ClickUp OAuth token management
 */
const express = require('express');
const router = express.Router();
const { EnhancedTokenManager } = require('../../enhanced_token_manager');

/**
 * Get master token status and health
 */
router.get('/status', async (req, res) => {
    try {
        const tokenManager = new EnhancedTokenManager();
        const status = await tokenManager.getTokenStatus();
        
        // Add system integration status
        const systemStatus = {
            ...status,
            timestamp: new Date().toISOString(),
            system_integration: {
                oauth_url: status.action === 'oauth_required' ? tokenManager.generateOAuthUrl() : null,
                refresh_endpoint: '/api/v2/master-token/refresh',
                migration_endpoint: '/api/v2/master-token/migrate'
            }
        };
        
        res.json({
            success: true,
            token_status: systemStatus
        });
        
    } catch (error) {
        console.error('Master token status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get token status'
        });
    }
});

/**
 * Migrate legacy token format
 */
router.post('/migrate', async (req, res) => {
    try {
        const tokenManager = new EnhancedTokenManager();
        const migrationResult = await tokenManager.migrateLegacyToken();
        
        if (migrationResult?.migrationRequired) {
            res.json({
                success: true,
                action: 'oauth_required',
                message: 'Legacy token detected. Master user must re-authenticate.',
                oauth_url: tokenManager.generateOAuthUrl(),
                legacy_token_info: {
                    created_at: migrationResult.legacyToken.createdAt,
                    last_used: migrationResult.legacyToken.lastUsed,
                    clickup_user: migrationResult.legacyToken.clickupUsername
                }
            });
        } else {
            res.json({
                success: true,
                action: 'none',
                message: 'Token already in enhanced format'
            });
        }
        
    } catch (error) {
        console.error('Token migration error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to migrate token'
        });
    }
});

/**
 * Force refresh master token
 */
router.post('/refresh', async (req, res) => {
    try {
        const tokenManager = new EnhancedTokenManager();
        const clickupAdapter = req.app.get('clickupAdapter');
        
        const currentToken = await tokenManager.loadToken();
        
        if (!currentToken) {
            return res.status(404).json({
                success: false,
                error: 'No token found',
                action: 'oauth_required',
                oauth_url: tokenManager.generateOAuthUrl()
            });
        }
        
        if (!tokenManager.canAttemptRefresh(currentToken)) {
            return res.status(400).json({
                success: false,
                error: 'Token cannot be refreshed',
                reason: currentToken.refreshToken ? 'Too many failed attempts' : 'No refresh token available',
                action: 'oauth_required',
                oauth_url: tokenManager.generateOAuthUrl()
            });
        }
        
        // Attempt refresh
        await tokenManager.recordRefreshAttempt(currentToken, false);
        
        try {
            const newTokenData = await clickupAdapter.refreshToken(currentToken.refreshToken);
            
            // Save enhanced token
            const enhancedToken = await tokenManager.saveEnhancedToken({
                ...newTokenData,
                clickupUserId: currentToken.clickupUserId,
                clickupUsername: currentToken.clickupUsername,
                clickupEmail: currentToken.clickupEmail,
                userEmail: currentToken.userEmail
            });
            
            await tokenManager.recordRefreshAttempt(enhancedToken, true);
            
            res.json({
                success: true,
                message: 'Token refreshed successfully',
                token_info: {
                    expires_at: enhancedToken.expiresAt,
                    expires_in_minutes: Math.floor((new Date(enhancedToken.expiresAt) - new Date()) / (1000 * 60)),
                    refresh_after: enhancedToken.refreshAfter,
                    next_check: enhancedToken.nextRefreshCheck
                }
            });
            
        } catch (refreshError) {
            console.error('Refresh failed:', refreshError);
            
            res.status(400).json({
                success: false,
                error: 'Token refresh failed',
                details: refreshError.message,
                action: 'oauth_required',
                oauth_url: tokenManager.generateOAuthUrl()
            });
        }
        
    } catch (error) {
        console.error('Master token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh token'
        });
    }
});

/**
 * Initiate OAuth re-authentication
 */
router.post('/oauth/initiate', (req, res) => {
    try {
        const tokenManager = new EnhancedTokenManager();
        const oauthUrl = tokenManager.generateOAuthUrl();
        
        res.json({
            success: true,
            action: 'redirect',
            oauth_url: oauthUrl,
            message: 'Redirect master user to ClickUp OAuth'
        });
        
    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate OAuth'
        });
    }
});

/**
 * Get proactive refresh recommendations
 */
router.get('/refresh-schedule', async (req, res) => {
    try {
        const tokenManager = new EnhancedTokenManager();
        const token = await tokenManager.loadToken();
        
        if (!token) {
            return res.json({
                success: true,
                schedule: null,
                recommendation: 'No token present - OAuth required'
            });
        }
        
        const now = new Date();
        const expiresAt = new Date(token.expiresAt);
        const timeUntilExpiry = Math.floor((expiresAt - now) / (1000 * 60));
        
        let recommendation;
        let nextAction;
        let urgency;
        
        if (timeUntilExpiry <= 0) {
            recommendation = 'Token expired - immediate refresh required';
            nextAction = 'refresh_now';
            urgency = 'critical';
        } else if (timeUntilExpiry <= 60) {
            recommendation = 'Token expires within 1 hour - refresh recommended';
            nextAction = 'refresh_soon';
            urgency = 'high';
        } else if (timeUntilExpiry <= 24 * 60) {
            recommendation = 'Token expires within 24 hours - proactive refresh suggested';
            nextAction = 'proactive_refresh';
            urgency = 'medium';
        } else {
            recommendation = 'Token healthy - no action required';
            nextAction = 'monitor';
            urgency = 'low';
        }
        
        res.json({
            success: true,
            schedule: {
                current_time: now.toISOString(),
                expires_at: token.expiresAt,
                time_until_expiry_minutes: timeUntilExpiry,
                refresh_after: token.refreshAfter,
                next_check: token.nextRefreshCheck,
                recommendation,
                next_action: nextAction,
                urgency,
                auto_refresh_enabled: token.autoRefreshEnabled
            }
        });
        
    } catch (error) {
        console.error('Refresh schedule error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get refresh schedule'
        });
    }
});

/**
 * Background token health monitor
 */
router.post('/health-check', async (req, res) => {
    try {
        const tokenManager = new EnhancedTokenManager();
        const clickupAdapter = req.app.get('clickupAdapter');
        
        const token = await tokenManager.loadToken();
        
        if (!token) {
            return res.json({
                success: true,
                health_status: 'no_token',
                action: 'oauth_required'
            });
        }
        
        // Test token with ClickUp API
        const testResult = await clickupAdapter.testConnection(token.accessToken);
        
        if (testResult.success) {
            // Token is working - update last used
            await tokenManager.updateLastUsed(token);
            
            return res.json({
                success: true,
                health_status: 'healthy',
                action: 'none',
                test_result: testResult
            });
        } else {
            // Token failed - check if can refresh
            if (tokenManager.canAttemptRefresh(token)) {
                return res.json({
                    success: true,
                    health_status: 'failed_can_refresh',
                    action: 'auto_refresh_recommended',
                    test_result: testResult
                });
            } else {
                return res.json({
                    success: true,
                    health_status: 'failed_need_oauth',
                    action: 'oauth_required',
                    test_result: testResult
                });
            }
        }
        
    } catch (error) {
        console.error('Token health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform health check'
        });
    }
});

module.exports = router;