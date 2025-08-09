/**
 * Single Authentication Routes
 * API endpoints for the new single-form login system
 * v2.2 - Enhanced with SPA support
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { AuthenticationService } = require('../../application/services/AuthenticationService');
const { SystemService } = require('../../application/services/SystemService');
const { 
    SystemNotReadyError,
    InvalidCredentialsError,
    UserNotFoundError,
    OAuthError,
    UnauthorizedUserError
} = require('../../application/errors/AuthenticationErrors');

const router = express.Router();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit per IP + email combination
        return `${req.ip}:${req.body.email || 'unknown'}`;
    }
});

/**
 * POST /api/v2/auth/login
 * Single form login with auto flow detection
 */
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        
        // Input validation
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required',
                code: 'MISSING_EMAIL'
            });
        }

        // For master user OAuth setup flow, password may not be required initially
        if (!password && email !== process.env.MASTER_USER_EMAIL) {
            return res.status(400).json({
                success: false,
                error: 'Password is required',
                code: 'MISSING_PASSWORD'
            });
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
                code: 'INVALID_EMAIL'
            });
        }
        
        const authService = req.app.get('authenticationService');
        // 🛡️ SECURITY: Pass request object for account lockout tracking
        const result = await authService.login(email, password, Boolean(rememberMe), req);
        
        // Handle OAuth setup required for master user
        if (result.status === 'oauth_setup_required') {
            return res.json({
                success: true,
                status: 'oauth_setup_required',
                redirect: true,
                location: result.redirectUrl,
                message: result.message,
                userId: result.userId
            });
        }

        // Handle OAuth setup completion
        if (result.status === 'oauth_setup_complete') {
            const cookieOptions = {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
                domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
            };
            
            res.cookie('taskflow_token', result.token, cookieOptions);
            
            return res.json({
                success: true,
                status: 'oauth_setup_complete',
                user: result.user,
                message: 'OAuth setup completed successfully'
            });
        }
        
        // Handle successful authentication (regular users and master after setup)
        if (result.success || result.status === 'authenticated') {
            const cookieOptions = {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
                domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
            };
            
            res.cookie('taskflow_token', result.token, cookieOptions);
            
            return res.json({
                success: true,
                status: 'authenticated',
                user: result.user,
                message: 'Login successful'
            });
        }

        // Legacy OAuth flow support
        if (result.requiresOAuth) {
            return res.json({
                success: true,
                redirect: true,
                location: result.location,
                message: 'Redirecting to ClickUp authentication'
            });
        }
        
        // Should not reach here, but handle unexpected cases
        return res.status(500).json({
            success: false,
            error: 'Unexpected authentication result',
            code: 'UNEXPECTED_ERROR'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Handle specific domain errors
        if (error instanceof SystemNotReadyError) {
            return res.status(503).json({
                success: false,
                error: error.message,
                code: 'SYSTEM_NOT_READY'
            });
        }
        
        if (error instanceof InvalidCredentialsError || error instanceof UserNotFoundError) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        if (error instanceof Error && error.message.includes('Invalid email format')) {
            return res.status(400).json({
                success: false,
                error: error.message,
                code: 'INVALID_EMAIL'
            });
        }
        
        // Generic error response
        return res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.',
            code: 'LOGIN_ERROR'
        });
    }
});

/**
 * GET /api/v2/system/status
 * Check system operational status
 */
router.get('/system/status', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const status = await systemService.getStatus();
        
        res.json(status.toApiResponse());
    } catch (error) {
        console.error('System status error:', error);
        res.status(500).json({
            clickup_connected: false,
            is_operational: false,
            status_level: 'error',
            message: 'System status check failed',
            error: error.message
        });
    }
});

/**
 * GET /api/v2/auth/oauth-setup-status
 * Check OAuth setup status for master user
 */
router.get('/oauth-setup-status', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email parameter is required',
                code: 'MISSING_EMAIL'
            });
        }

        const authService = req.app.get('authenticationService');
        const setupStatus = await authService.checkOAuthSetupStatus(email);
        
        return res.json({
            success: true,
            ...setupStatus
        });
        
    } catch (error) {
        console.error('OAuth setup status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check OAuth setup status',
            code: 'OAUTH_STATUS_ERROR'
        });
    }
});

/**
 * POST /api/v2/auth/complete-oauth-setup
 * Complete OAuth setup for master user (called from OAuth callback)
 */
router.post('/complete-oauth-setup', async (req, res) => {
    try {
        const { userId, tokens, userInfo } = req.body;
        
        if (!userId || !tokens) {
            return res.status(400).json({
                success: false,
                error: 'User ID and tokens are required',
                code: 'MISSING_SETUP_DATA'
            });
        }

        const authService = req.app.get('authenticationService');
        const result = await authService.completeOAuthSetup(userId, tokens, userInfo);
        
        // Set authentication cookie
        const cookieOptions = {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
        };
        
        res.cookie('taskflow_token', result.token, cookieOptions);
        
        return res.json({
            success: true,
            status: result.status,
            user: result.user,
            message: 'OAuth setup completed successfully'
        });
        
    } catch (error) {
        console.error('OAuth setup completion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete OAuth setup',
            code: 'OAUTH_SETUP_ERROR'
        });
    }
});

/**
 * POST /api/v2/auth/logout
 * Logout user
 */
router.post('/logout', async (req, res) => {
    try {
        // Clear the HttpOnly cookie
        res.clearCookie('taskflow_token', {
            httpOnly: true,
            secure: false, // Temporarily disabled for HTTP testing
            sameSite: 'lax',
            domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
        });
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            code: 'LOGOUT_ERROR'
        });
    }
});

/**
 * GET /api/v2/auth/verify
 * Verify JWT token
 */
router.get('/verify', async (req, res) => {
    try {
        const jwtService = req.app.get('jwtService');
        
        // Get token from cookie or header
        let token = req.cookies?.taskflow_token;
        if (!token) {
            token = jwtService.extractTokenFromHeader(req.headers.authorization);
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
                code: 'TOKEN_MISSING'
            });
        }
        
        const authService = req.app.get('authenticationService');
        const result = await authService.verifyToken(token);
        
        res.json({
            success: true,
            user: result.user,
            valid: true
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({
            success: false,
            error: error.message,
            code: 'TOKEN_INVALID'
        });
    }
});

/**
 * POST /api/v2/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req, res) => {
    try {
        const jwtService = req.app.get('jwtService');
        
        // Get current token
        let token = req.cookies?.taskflow_token;
        if (!token) {
            token = jwtService.extractTokenFromHeader(req.headers.authorization);
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token to refresh',
                code: 'TOKEN_MISSING'
            });
        }
        
        const authService = req.app.get('authenticationService');
        const result = await authService.refreshToken(token);
        
        // Set new token in cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            domain: process.env.NODE_ENV === 'production' ? '192.168.20.10' : undefined
        };
        
        res.cookie('taskflow_token', result.token, cookieOptions);
        
        res.json({
            success: true,
            user: result.user,
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: 'Failed to refresh token',
            code: 'REFRESH_ERROR'
        });
    }
});

/**
 * GET /api/v2/auth/profile
 * Get user profile (requires authentication)
 */
router.get('/profile', async (req, res) => {
    try {
        const jwtService = req.app.get('jwtService');
        
        // Get and verify token
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
        const authService = req.app.get('authenticationService');
        
        // Use userId if available, fallback to finding user by email
        let userId = payload.sub || payload.userId;
        if (!userId && payload.email) {
            // Fallback: find user by email if userId not in token
            const userRepository = req.app.get('userRepository');
            const user = await userRepository.findByEmail(payload.email);
            userId = user ? user.id : null;
        }
        
        if (!userId) {
            throw new Error('User identification failed');
        }
        
        const profile = await authService.getUserProfile(userId);
        
        res.json({
            success: true,
            user: profile
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(401).json({
            success: false,
            error: 'Failed to get profile',
            code: 'PROFILE_ERROR'
        });
    }
});

/**
 * POST /api/v2/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required',
                code: 'MISSING_PASSWORDS'
            });
        }
        
        const jwtService = req.app.get('jwtService');
        
        // Get and verify token
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
        const authService = req.app.get('authenticationService');
        
        await authService.changePassword(payload.sub, currentPassword, newPassword);
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        
        if (error.message.includes('Current password is incorrect')) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect',
                code: 'INVALID_CURRENT_PASSWORD'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to change password',
            code: 'PASSWORD_CHANGE_ERROR'
        });
    }
});

/**
 * GET /api/v2/auth/system-status
 * System status alias for backward compatibility
 */
router.get('/system-status', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const status = await systemService.getStatus();
        
        res.json({
            success: true,
            system_operational: status.is_operational,
            clickup_connected: status.clickup_connected,
            status_level: status.status_level,
            message: status.message,
            last_checked: status.last_checked,
            expires_at: status.expires_at
        });
    } catch (error) {
        console.error('System status check error:', error);
        res.status(500).json({
            success: false,
            system_operational: false,
            clickup_connected: false,
            status_level: 'error',
            message: 'System status check failed',
            error: error.message
        });
    }
});

/**
 * GET /api/v2/auth/me
 * Token validation endpoint for SPA
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        const authService = req.app.get('authService');
        
        // Validate token and get user info
        const validation = await authService.validateToken(token);
        
        if (validation.valid) {
            res.json({
                success: true,
                data: validation.user
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Token validation failed',
            code: 'VALIDATION_ERROR'
        });
    }
});

/**
 * POST /api/v2/auth/logout
 * Logout endpoint for SPA
 */
router.post('/logout', async (req, res) => {
    try {
        // Clear cookies
        res.clearCookie('auth_token');
        res.clearCookie('refresh_token');
        
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

module.exports = router;