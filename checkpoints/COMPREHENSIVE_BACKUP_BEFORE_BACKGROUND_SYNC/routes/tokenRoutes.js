/**
 * Token Management API Routes
 * Handle JWT token operations and refresh logic
 */
const express = require('express');
const router = express.Router();

/**
 * Refresh JWT token
 * Generates new token with extended expiry
 */
router.post('/refresh', async (req, res) => {
    try {
        const authService = req.app.get('authService');
        const jwtService = req.app.get('jwtService');
        
        // Get current token from cookie or header
        const currentToken = req.cookies.auth_token || 
                           req.headers.authorization?.replace('Bearer ', '');
        
        if (!currentToken) {
            return res.status(401).json({
                success: false,
                error: 'No token provided for refresh'
            });
        }
        
        // Verify current token and get user info
        let payload;
        try {
            payload = jwtService.verifyToken(currentToken);
        } catch (error) {
            // If token is expired, allow refresh within grace period
            if (error.message.includes('expired')) {
                const decoded = jwtService.decodeToken(currentToken);
                if (decoded && isWithinGracePeriod(decoded.payload.exp)) {
                    payload = decoded.payload;
                } else {
                    return res.status(401).json({
                        success: false,
                        error: 'Token expired beyond grace period'
                    });
                }
            } else {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token for refresh'
                });
            }
        }
        
        // Get updated user profile
        const userProfile = await authService.getUserProfile(payload.userId || payload.sub);
        
        // Generate new token with updated capabilities
        const newTokenPayload = {
            userId: userProfile.user.id,
            email: userProfile.user.email,
            role: userProfile.user.role,
            capabilities: userProfile.capabilities,
            displayName: userProfile.displayName
        };
        
        const newToken = jwtService.generateToken(newTokenPayload, '24h');
        
        // Set new token in HTTP-only cookie
        res.cookie('auth_token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            user: userProfile.user,
            capabilities: userProfile.capabilities,
            expiresIn: '24h'
        });
        
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh token'
        });
    }
});

/**
 * Check token validity and time until expiry
 */
router.get('/status', (req, res) => {
    try {
        const jwtService = req.app.get('jwtService');
        const token = req.cookies.auth_token || 
                     req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.json({
                success: true,
                valid: false,
                message: 'No token present'
            });
        }
        
        try {
            const payload = jwtService.verifyToken(token);
            const timeUntilExpiry = jwtService.getTimeUntilExpiry(token);
            const expiration = jwtService.getTokenExpiration(token);
            
            res.json({
                success: true,
                valid: true,
                user: {
                    userId: payload.userId || payload.sub,
                    email: payload.email,
                    role: payload.role,
                    displayName: payload.displayName
                },
                timeUntilExpiry: timeUntilExpiry,
                expiration: expiration,
                needsRefresh: timeUntilExpiry < 60 // Needs refresh if < 60 minutes
            });
        } catch (error) {
            // Check if within grace period for expired tokens
            const decoded = jwtService.decodeToken(token);
            if (decoded && isWithinGracePeriod(decoded.payload.exp)) {
                res.json({
                    success: true,
                    valid: false,
                    expired: true,
                    gracePeriod: true,
                    message: 'Token expired but within grace period',
                    canRefresh: true
                });
            } else {
                res.json({
                    success: true,
                    valid: false,
                    expired: true,
                    message: error.message,
                    canRefresh: false
                });
            }
        }
        
    } catch (error) {
        console.error('Token status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check token status'
        });
    }
});

/**
 * Validate token and return user info
 */
router.post('/validate', (req, res) => {
    try {
        const jwtService = req.app.get('jwtService');
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required'
            });
        }
        
        try {
            const payload = jwtService.verifyToken(token);
            
            res.json({
                success: true,
                valid: true,
                payload: {
                    userId: payload.userId || payload.sub,
                    email: payload.email,
                    role: payload.role,
                    capabilities: payload.capabilities,
                    displayName: payload.displayName
                }
            });
        } catch (error) {
            res.json({
                success: true,
                valid: false,
                error: error.message
            });
        }
        
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate token'
        });
    }
});

/**
 * Revoke/invalidate token (logout)
 */
router.post('/revoke', (req, res) => {
    try {
        // Clear auth cookie
        res.clearCookie('auth_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        
        res.json({
            success: true,
            message: 'Token revoked successfully'
        });
        
    } catch (error) {
        console.error('Token revocation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke token'
        });
    }
});

/**
 * Get token expiry information
 */
router.get('/expiry', (req, res) => {
    try {
        const jwtService = req.app.get('jwtService');
        const token = req.cookies.auth_token || 
                     req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }
        
        const expiration = jwtService.getTokenExpiration(token);
        const timeUntilExpiry = jwtService.getTimeUntilExpiry(token);
        const isExpired = jwtService.isTokenExpired(token);
        
        res.json({
            success: true,
            expiration: expiration,
            timeUntilExpiry: timeUntilExpiry,
            isExpired: isExpired,
            formatted: {
                expiration: expiration ? expiration.toISOString() : null,
                timeUntilExpiry: `${timeUntilExpiry} minutes`,
                status: isExpired ? 'expired' : 
                       timeUntilExpiry < 60 ? 'expires_soon' : 'valid'
            }
        });
        
    } catch (error) {
        console.error('Token expiry check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check token expiry'
        });
    }
});

/**
 * Utility function to check if token is within grace period
 */
function isWithinGracePeriod(expTimestamp) {
    const gracePeriodMinutes = parseInt(process.env.TOKEN_GRACE_PERIOD_MINUTES) || 30;
    const gracePeriodMs = gracePeriodMinutes * 60 * 1000;
    const expiredAt = expTimestamp * 1000;
    const now = Date.now();
    
    return (now - expiredAt) <= gracePeriodMs;
}

/**
 * Background token refresh endpoint for proactive refresh
 */
router.post('/background-refresh', async (req, res) => {
    try {
        const authService = req.app.get('authService');
        const jwtService = req.app.get('jwtService');
        
        const token = req.cookies.auth_token;
        if (!token) {
            return res.json({
                success: false,
                action: 'no_token',
                message: 'No token to refresh'
            });
        }
        
        const timeUntilExpiry = jwtService.getTimeUntilExpiry(token);
        
        // Only refresh if token expires within 2 hours
        if (timeUntilExpiry > 120) {
            return res.json({
                success: true,
                action: 'no_refresh_needed',
                timeUntilExpiry: timeUntilExpiry,
                message: 'Token still valid for more than 2 hours'
            });
        }
        
        // Perform refresh
        const payload = jwtService.verifyToken(token);
        const userProfile = await authService.getUserProfile(payload.userId || payload.sub);
        
        const newTokenPayload = {
            userId: userProfile.user.id,
            email: userProfile.user.email,
            role: userProfile.user.role,
            capabilities: userProfile.capabilities,
            displayName: userProfile.displayName
        };
        
        const newToken = jwtService.generateToken(newTokenPayload, '24h');
        
        res.cookie('auth_token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });
        
        res.json({
            success: true,
            action: 'refreshed',
            message: 'Token refreshed successfully',
            newExpiry: jwtService.getTokenExpiration(newToken)
        });
        
    } catch (error) {
        console.error('Background refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform background refresh'
        });
    }
});

module.exports = router;