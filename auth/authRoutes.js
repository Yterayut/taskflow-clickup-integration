const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { AuthService } = require('./authService');
const { JWTAuth, authenticateToken } = require('./jwt');

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        error: 'Too many login attempts, please try again later.',
        retryAfter: 15 * 60 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation middleware
const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 3 })
        .withMessage('Password must be at least 3 characters long')
        .trim(),
    body('rememberMe')
        .optional()
        .isBoolean()
        .withMessage('Remember me must be a boolean value')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post('/login', authLimiter, loginValidation, handleValidationErrors, async (req, res) => {
    try {
        const { email, password, rememberMe = false } = req.body;
        
        console.log(`[AUTH] Login attempt for email: ${email}`);
        
        // Authenticate user
        const result = await AuthService.loginWithPassword(email, password);
        
        if (!result.success) {
            console.log(`[AUTH] Login failed for ${email}: ${result.message}`);
            return res.status(401).json({
                success: false,
                message: result.message || 'Invalid email or password'
            });
        }
        
        const { user, clickupToken } = result;
        
        // Generate JWT token
        const tokenExpiry = rememberMe ? '30d' : '24h';
        const token = JWTAuth.generateToken({
            userId: user.id,
            email: user.email,
            role: user.role
        }, tokenExpiry);
        
        // Set HTTP-only cookie for additional security
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 24 hours
        };
        
        res.cookie('taskflow_token', token, cookieOptions);
        
        console.log(`[AUTH] Login successful for ${email} (${user.role})`);
        
        // Return success response
        res.json({
            success: true,
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
                lastLogin: user.last_login
            },
            clickupConnected: !!clickupToken,
            expiresIn: tokenExpiry
        });
        
    } catch (error) {
        console.error('[AUTH] Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again.'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate token
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log(`[AUTH] Logout for user ID: ${userId}`);
        
        // Clear HTTP-only cookie
        res.clearCookie('taskflow_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
        
        // In a production system, you might want to add the token to a blacklist
        // For now, we'll just clear the cookie and rely on client-side token removal
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
        
    } catch (error) {
        console.error('[AUTH] Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

/**
 * GET /api/auth/verify
 * Verify JWT token and return user info
 */
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Get fresh user data from database
        const user = await AuthService.getUserById(userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if user has ClickUp token
        const clickupToken = await AuthService.getClickUpToken(userId);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
                lastLogin: user.last_login,
                isActive: user.is_active
            },
            clickupConnected: !!clickupToken
        });
        
    } catch (error) {
        console.error('[AUTH] Token verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const { userId, email, role } = req.user;
        
        // Generate new token
        const newToken = JWTAuth.generateToken({
            userId,
            email,
            role
        }, '24h');
        
        // Set new HTTP-only cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        };
        
        res.cookie('taskflow_token', newToken, cookieOptions);
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            token: newToken,
            expiresIn: '24h'
        });
        
    } catch (error) {
        console.error('[AUTH] Token refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Token refresh failed'
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change user password (requires current password)
 */
router.post('/change-password', 
    authenticateToken,
    [
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 6 })
            .withMessage('New password must be at least 6 characters long'),
        body('confirmPassword')
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error('Password confirmation does not match');
                }
                return true;
            })
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.userId;
            
            // Change password
            const result = await AuthService.changePassword(userId, currentPassword, newPassword);
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }
            
            console.log(`[AUTH] Password changed for user ID: ${userId}`);
            
            res.json({
                success: true,
                message: 'Password changed successfully'
            });
            
        } catch (error) {
            console.error('[AUTH] Password change error:', error);
            res.status(500).json({
                success: false,
                message: 'Password change failed'
            });
        }
    }
);

/**
 * GET /api/auth/profile
 * Get user profile information
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const user = await AuthService.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const clickupToken = await AuthService.getClickUpToken(userId);
        
        res.json({
            success: true,
            profile: {
                id: user.id,
                email: user.email,
                role: user.role,
                fullName: user.full_name,
                createdAt: user.created_at,
                lastLogin: user.last_login,
                isActive: user.is_active,
                clickupConnected: !!clickupToken
            }
        });
        
    } catch (error) {
        console.error('[AUTH] Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile'
        });
    }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'TaskFlow Pro Authentication Service',
        timestamp: new Date().toISOString(),
        status: 'healthy'
    });
});

module.exports = router;