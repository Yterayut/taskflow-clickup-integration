/**
 * Enhanced OAuth Callback Handler
 * Handles ClickUp OAuth with enhanced token management
 */
const { EnhancedTokenManager } = require('./enhanced_token_manager');

class EnhancedOAuthHandler {
    constructor(clickupAdapter) {
        this.clickupAdapter = clickupAdapter;
        this.tokenManager = new EnhancedTokenManager();
    }

    /**
     * Handle OAuth callback with enhanced token storage
     */
    async handleCallback(code, state) {
        try {
            console.log('🔄 Processing OAuth callback with enhanced token management');

            // Validate state parameter (keep existing validation logic)
            if (!this.validateState(state)) {
                throw new Error('Invalid OAuth state parameter');
            }

            // Exchange code for tokens
            const tokenData = await this.clickupAdapter.exchangeCodeForTokens(code);
            console.log('✅ Token exchange successful:', {
                hasAccessToken: !!tokenData.access_token,
                hasRefreshToken: !!tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                tokenType: tokenData.token_type
            });

            // Get user info
            const userInfo = await this.clickupAdapter.getUserInfo(tokenData.access_token);
            console.log('✅ User info retrieved:', {
                id: userInfo.id,
                username: userInfo.username,
                email: userInfo.email
            });

            // Validate master user
            if (!this.clickupAdapter.validateMasterUser(userInfo)) {
                throw new Error('Unauthorized user - not master user');
            }

            // Create backup of old token
            await this.tokenManager.createBackup();

            // Save enhanced token with all required fields
            const enhancedToken = await this.tokenManager.saveEnhancedToken({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: tokenData.expires_in || 3600,
                token_type: tokenData.token_type || 'Bearer',
                scope: tokenData.scope,
                
                // User context
                clickupUserId: userInfo.id,
                clickupUsername: userInfo.username,
                clickupEmail: userInfo.email,
                userEmail: userInfo.email
            });

            console.log('✅ Enhanced token saved:', {
                expiresAt: enhancedToken.expiresAt,
                refreshAfter: enhancedToken.refreshAfter,
                autoRefreshEnabled: enhancedToken.autoRefreshEnabled
            });

            // Test the new token immediately
            const testResult = await this.clickupAdapter.testConnection(enhancedToken.accessToken);
            if (!testResult.success) {
                console.warn('⚠️ New token failed immediate test:', testResult.error);
            } else {
                console.log('✅ New token tested successfully');
                await this.tokenManager.updateLastUsed(enhancedToken);
            }

            return {
                success: true,
                message: 'OAuth authentication successful with enhanced token management',
                tokenInfo: {
                    expiresAt: enhancedToken.expiresAt,
                    expiresInMinutes: Math.floor((new Date(enhancedToken.expiresAt) - new Date()) / (1000 * 60)),
                    autoRefreshEnabled: enhancedToken.autoRefreshEnabled,
                    nextRefreshCheck: enhancedToken.nextRefreshCheck
                },
                userInfo: {
                    id: userInfo.id,
                    username: userInfo.username,
                    email: userInfo.email
                }
            };

        } catch (error) {
            console.error('Enhanced OAuth callback error:', error);
            throw new Error(`OAuth authentication failed: ${error.message}`);
        }
    }

    /**
     * Validate OAuth state with enhanced validation
     */
    validateState(state) {
        if (!state || !state.startsWith('taskflow_')) {
            return false;
        }

        const stateParts = state.split('_');
        if (stateParts.length < 3) {
            return false;
        }

        const timestamp = parseInt(stateParts[1]);
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        return timestamp && (Date.now() - timestamp) < maxAge;
    }

    /**
     * Create enhanced OAuth routes
     */
    createRoutes() {
        const express = require('express');
        const router = express.Router();

        // Initiate OAuth with enhanced state management
        router.get('/clickup', (req, res) => {
            try {
                const state = 'taskflow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                
                // Store state with enhanced validation
                req.session.oauth_state = state;
                req.session.oauth_timestamp = Date.now();
                req.session.oauth_enhanced = true;
                
                const authUrl = this.clickupAdapter.getAuthorizationUrl(state);
                
                console.log('🔄 Enhanced OAuth initiated:', {
                    state,
                    timestamp: new Date().toISOString(),
                    sessionId: req.sessionID
                });
                
                res.redirect(authUrl);
            } catch (error) {
                console.error('Enhanced OAuth initiation error:', error);
                res.redirect('http://192.168.20.10:8888/enhanced_login_with_token_manager.html?error=oauth_init_failed');
            }
        });

        // Handle OAuth callback with enhanced processing
        router.get('/clickup/callback', async (req, res) => {
            try {
                const { code, state, error } = req.query;
                
                if (error) {
                    console.error('OAuth callback error:', error);
                    return res.redirect('http://192.168.20.10:8888/enhanced_login_with_token_manager.html?error=oauth_denied');
                }
                
                if (!code) {
                    console.error('OAuth callback missing code');
                    return res.redirect('http://192.168.20.10:8888/enhanced_login_with_token_manager.html?error=oauth_invalid');
                }

                // Enhanced state validation
                let stateValid = false;
                
                // Session-based validation
                if (req.session.oauth_state && state === req.session.oauth_state) {
                    stateValid = true;
                    console.log('✅ State validated via session');
                }
                // Fallback validation for session issues
                else if (this.validateState(state)) {
                    stateValid = true;
                    console.log('✅ State validated via fallback method');
                }

                if (!stateValid) {
                    console.error('Invalid OAuth state:', { received: state, expected: req.session.oauth_state });
                    return res.redirect('http://192.168.20.10:8888/enhanced_login_with_token_manager.html?error=oauth_invalid_state');
                }

                // Process OAuth with enhanced token management
                const result = await this.handleCallback(code, state);
                
                // Clear OAuth session data
                delete req.session.oauth_state;
                delete req.session.oauth_timestamp;
                delete req.session.oauth_enhanced;

                console.log('✅ Enhanced OAuth completed successfully');
                
                // Redirect to enhanced login page with success
                res.redirect('http://192.168.20.10:8888/enhanced_login_with_token_manager.html?oauth=success&token_enhanced=true');

            } catch (error) {
                console.error('Enhanced OAuth callback error:', error);
                res.redirect('http://192.168.20.10:8888/enhanced_login_with_token_manager.html?error=oauth_callback_failed');
            }
        });

        return router;
    }
}

module.exports = { EnhancedOAuthHandler };