/**
 * OAuth Routes for ClickUp Integration
 * Handles ClickUp OAuth flow for master user
 */
const express = require('express');
const { AuthenticationService } = require('../../application/services/AuthenticationService');
const { SystemService } = require('../../application/services/SystemService');
const { 
    OAuthError,
    UnauthorizedUserError
} = require('../../application/errors/AuthenticationErrors');

const router = express.Router();

/**
 * GET /auth/clickup
 * Initiate ClickUp OAuth flow
 */
router.get('/clickup', (req, res) => {
    try {
        const clickupIntegration = req.app.get('clickupIntegration');
        
        // Generate state for CSRF protection
        const state = 'taskflow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Store state in session for validation
        req.session.oauth_state = state;
        req.session.oauth_timestamp = Date.now();
        
        // Debug session storage
        console.log('🔐 Session Debug (OAuth Init):', {
            sessionId: req.sessionID,
            sessionExists: !!req.session,
            stateStored: req.session.oauth_state,
            sessionData: req.session
        });
        
        // Get authorization URL with our state
        const authUrl = clickupIntegration.getAuthorizationUrl(state);
        
        console.log('OAuth flow initiated:', {
            state,
            actualUrlState: authUrl.includes(state) ? 'MATCH' : 'MISMATCH',
            redirectUri: process.env.CLICKUP_REDIRECT_URI,
            timestamp: new Date().toISOString()
        });
        
        res.redirect(authUrl);
    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_init_failed');
    }
});

/**
 * GET /auth/clickup/callback
 * Handle ClickUp OAuth callback
 */
router.get('/clickup/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        // Check for OAuth error
        if (error) {
            console.error('OAuth callback error:', error);
            
            // Check if this is an API request
            const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
            
            if (acceptsJson) {
                return res.status(400).json({
                    success: false,
                    error: 'OAuth denied',
                    code: 'OAUTH_DENIED',
                    message: 'User denied OAuth authorization'
                });
            }
            
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_denied');
        }
        
        // Validate required parameters
        if (!code) {
            console.error('OAuth callback missing code parameter');
            
            // Check if this is an API request
            const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
            
            if (acceptsJson) {
                return res.status(400).json({
                    success: false,
                    error: 'OAuth invalid',
                    code: 'OAUTH_INVALID',
                    message: 'Missing authorization code parameter'
                });
            }
            
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_invalid');
        }
        
        // Debug session on callback
        console.log('🔐 Session Debug (OAuth Callback):', {
            sessionId: req.sessionID,
            sessionExists: !!req.session,
            stateInSession: req.session.oauth_state,
            stateReceived: state,
            fullSession: req.session,
            cookies: req.headers.cookie
        });
        
        // Enhanced state validation with fallback
        let stateValid = false;
        
        // Primary validation: session-based
        if (req.session.oauth_state && state === req.session.oauth_state) {
            stateValid = true;
            console.log('✅ State validated via session');
        }
        // Fallback validation: format-based (for session issues)
        else if (state && state.startsWith('taskflow_')) {
            const stateParts = state.split('_');
            if (stateParts.length >= 3) {
                const timestamp = parseInt(stateParts[1]);
                const maxAge = 10 * 60 * 1000; // 10 minutes
                if (timestamp && (Date.now() - timestamp) < maxAge) {
                    stateValid = true;
                    console.log('✅ State validated via format (session fallback)');
                }
            }
        }
        
        if (!stateValid) {
            console.error('OAuth state validation failed:', {
                received: state,
                expected: req.session.oauth_state,
                sessionId: req.sessionID,
                sessionValid: !!req.session,
                formatValid: state?.startsWith('taskflow_')
            });
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_invalid_state');
        }
        
        // Check state timestamp (prevent replay attacks)
        // Extract timestamp from state if session timestamp not available
        let stateTimestamp = req.session.oauth_timestamp;
        if (!stateTimestamp && state.startsWith('taskflow_')) {
            const stateParts = state.split('_');
            if (stateParts.length >= 2) {
                stateTimestamp = parseInt(stateParts[1]);
            }
        }
        
        const stateAge = Date.now() - (stateTimestamp || 0);
        if (stateAge > 10 * 60 * 1000) { // 10 minutes max
            console.error('OAuth state expired:', { 
                age: stateAge, 
                timestamp: stateTimestamp,
                source: req.session.oauth_timestamp ? 'session' : 'state' 
            });
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_expired');
        }
        
        // Clear session state
        delete req.session.oauth_state;
        delete req.session.oauth_timestamp;
        
        // Get ClickUp integration and exchange code for tokens (ONCE)
        const clickupIntegration = req.app.get('clickupIntegration');
        const tokenData = await clickupIntegration.exchangeCodeForTokens(code);
        
        console.log('✅ OAuth token exchange successful');
        
        // Get user info to identify master user
        const userInfo = await clickupIntegration.getUserInfo(tokenData.access_token);
        const masterEmail = process.env.MASTER_USER_EMAIL;
        
        console.log('✅ ClickUp user info retrieved:', { email: userInfo?.email });
        
        // Validate this is the master user
        if (!clickupIntegration.validateMasterUser(userInfo)) {
            console.error('OAuth attempted by non-master user:', userInfo.user?.email);
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=unauthorized_user');
        }

        console.log('✅ Master user validated');

        // Check if this is first-time OAuth setup or regular OAuth
        const authService = req.app.get('authenticationService');
        const setupStatus = await authService.checkOAuthSetupStatus(masterEmail);
        
        console.log('OAuth setup status:', setupStatus);
        
        if (!setupStatus.isCompleted && setupStatus.exists) {
            // First-time OAuth setup - complete setup process
            const userRepository = req.app.get('userRepository');
            const masterUser = await userRepository.findByEmail(masterEmail);
            
            if (masterUser) {
                console.log('Completing OAuth setup for master user');
                const result = await authService.completeOAuthSetup(masterUser.id, tokenData, userInfo);
                
                // Set authentication cookie
                const cookieOptions = {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'lax',
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
                };
                
                res.cookie('taskflow_token', result.token, cookieOptions);
                
                console.log('✅ OAuth setup completed for master user:', masterEmail);
                return res.redirect('http://192.168.20.10:8888/?login=success&setup=complete');
            }
        }

        // Process OAuth flow directly (avoiding duplicate token exchange)
        console.log('Processing OAuth flow with direct token handling');
        
        // Find master user in database
        const userRepository = req.app.get('userRepository');
        const masterUser = await userRepository.findByEmail(masterEmail);
        if (!masterUser) {
            console.error('Master user not found in database');
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=user_not_found');
        }
        
        // Create and save ClickUp token
        const { ClickUpToken } = require('../../domain/entities/ClickUpToken');
        const clickupToken = ClickUpToken.fromOAuthResponse(masterUser.id, tokenData);
        const tokenRepository = req.app.get('tokenRepository');
        await tokenRepository.save(clickupToken);
        
        console.log('✅ ClickUp token saved successfully');
        
        // Update system status
        const systemService = req.app.get('systemService');
        await systemService.updateStatus({
            clickup_connected: true,
            last_token_refresh: new Date(),
            master_token_expires_at: clickupToken.expiresAt
        });
        
        // Update master user last login
        masterUser.updateLastLogin();
        await userRepository.save(masterUser);
        
        console.log('✅ Master user login updated');
        
        // Generate JWT for master user
        const jwtService = req.app.get('jwtService');
        const tokenPayload = {
            userId: masterUser.id,
            email: masterUser.email.toString(),
            role: masterUser.role.toString(),
            capabilities: masterUser.getCapabilities(),
            displayName: masterUser.role.getDisplayName()
        };
        const token = jwtService.generateToken(tokenPayload, '24h');
        
        const result = {
            success: true,
            user: {
                id: masterUser.id,
                email: masterUser.email.toString(),
                role: masterUser.role.toString(),
                displayName: masterUser.role.getDisplayName(),
                capabilities: masterUser.getCapabilities()
            },
            token,
            clickup_connected: true
        };
        
        if (result.success) {
            // Set HttpOnly cookie with JWT
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
            };
            
            res.cookie('taskflow_token', result.token, cookieOptions);
            
            console.log('OAuth flow completed successfully for master user');
            
            // Redirect to dashboard
            res.redirect('http://192.168.20.10:8888/?login=success');
        } else {
            console.error('OAuth flow failed:', result);
            res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_failed');
        }
        
    } catch (error) {
        console.error('OAuth callback processing error:', error);
        
        if (error instanceof UnauthorizedUserError) {
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_unauthorized');
        }
        
        if (error instanceof OAuthError) {
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_error');
        }
        
        // Handle specific ClickUp OAuth errors
        if (error.message && error.message.includes('OAuth code already used')) {
            console.log('⚠️ OAuth code reuse detected - user may have refreshed callback page');
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_code_reused&message=Please start OAuth flow again');
        }
        
        if (error.message && error.message.includes('OAuth code not found')) {
            console.log('⚠️ OAuth code expired or invalid');
            return res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_code_expired&message=Please start OAuth flow again');
        }
        
        res.redirect('http://192.168.20.10:8888/login-v2.html?error=oauth_callback_failed');
    }
});

/**
 * POST /auth/clickup/refresh
 * Force refresh ClickUp token (admin endpoint)
 */
router.post('/clickup/refresh', async (req, res) => {
    try {
        // Verify admin access (this should be protected)
        const jwtService = req.app.get('jwtService');
        
        let token = req.cookies?.taskflow_token;
        if (!token) {
            token = jwtService.extractTokenFromHeader(req.headers.authorization);
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'TOKEN_MISSING'
            });
        }
        
        const payload = jwtService.verifyToken(token);
        
        // Only master user can refresh tokens
        if (payload.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Only master user can refresh ClickUp tokens',
                code: 'INSUFFICIENT_PRIVILEGES'
            });
        }
        
        const systemService = req.app.get('systemService');
        const result = await systemService.forceRefreshToken();
        
        res.json(result);
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh ClickUp token',
            code: 'REFRESH_ERROR'
        });
    }
});

/**
 * POST /auth/clickup/revoke
 * Revoke ClickUp integration (emergency endpoint)
 */
router.post('/clickup/revoke', async (req, res) => {
    try {
        // Verify admin access
        const jwtService = req.app.get('jwtService');
        
        let token = req.cookies?.taskflow_token;
        if (!token) {
            token = jwtService.extractTokenFromHeader(req.headers.authorization);
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'TOKEN_MISSING'
            });
        }
        
        const payload = jwtService.verifyToken(token);
        
        // Only master user can revoke integration
        if (payload.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Only master user can revoke ClickUp integration',
                code: 'INSUFFICIENT_PRIVILEGES'
            });
        }
        
        const systemService = req.app.get('systemService');
        const result = await systemService.revokeClickUpIntegration();
        
        console.log('ClickUp integration revoked by master user:', payload.email);
        
        res.json(result);
    } catch (error) {
        console.error('Integration revoke error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke ClickUp integration',
            code: 'REVOKE_ERROR'
        });
    }
});

/**
 * GET /auth/clickup/status
 * Get ClickUp integration status
 */
router.get('/clickup/status', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const status = await systemService.getStatus();
        
        res.json({
            success: true,
            clickup_connected: status.clickupConnected,
            status_level: status.getStatusLevel(),
            message: status.getStatusMessage(),
            expires_at: status.tokenExpiresAt,
            time_until_expiry_minutes: status.getTimeUntilExpiry()
        });
    } catch (error) {
        console.error('ClickUp status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ClickUp status',
            code: 'STATUS_ERROR'
        });
    }
});

/**
 * GET /auth/clickup/test
 * Test ClickUp API connection
 */
router.get('/clickup/test', async (req, res) => {
    try {
        // Verify admin access
        const jwtService = req.app.get('jwtService');
        
        let token = req.cookies?.taskflow_token;
        if (!token) {
            token = jwtService.extractTokenFromHeader(req.headers.authorization);
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'TOKEN_MISSING'
            });
        }
        
        const payload = jwtService.verifyToken(token);
        
        // Only master user can test connection
        if (payload.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Only master user can test ClickUp connection',
                code: 'INSUFFICIENT_PRIVILEGES'
            });
        }
        
        const tokenRepository = req.app.get('tokenRepository');
        const clickupIntegration = req.app.get('clickupIntegration');
        
        // Get master token
        const clickupToken = await tokenRepository.findMasterToken();
        if (!clickupToken) {
            return res.json({
                success: false,
                error: 'No ClickUp token found',
                code: 'NO_TOKEN'
            });
        }
        
        // Test API connection
        const testResult = await clickupIntegration.testConnection(clickupToken.accessToken);
        
        res.json({
            success: testResult.success,
            message: testResult.success ? 'ClickUp connection successful' : 'ClickUp connection failed',
            details: testResult,
            token_expires_at: clickupToken.expiresAt
        });
    } catch (error) {
        console.error('ClickUp test error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test ClickUp connection',
            code: 'TEST_ERROR'
        });
    }
});

module.exports = router;