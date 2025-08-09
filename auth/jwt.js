const jwt = require('jsonwebtoken');
const { Database } = require('../database/config');

class JWTAuth {
    static generateToken(payload, expiresIn = null) {
        try {
            console.log('[DEBUG JWT] Generating token for payload:', {
                userId: payload.userId,
                email: payload.email,
                role: payload.role
            });
            console.log('[DEBUG JWT] JWT_SECRET exists:', !!process.env.JWT_SECRET);
            console.log('[DEBUG JWT] Expires in:', expiresIn || process.env.JWT_EXPIRES_IN || '24h');
            
            const token = jwt.sign(
                {
                    userId: payload.userId,
                    email: payload.email,
                    role: payload.role,
                    iat: Math.floor(Date.now() / 1000)
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '24h',
                    issuer: 'taskflow-pro',
                    audience: 'taskflow-users'
                }
            );
            
            console.log('[DEBUG JWT] Token generated successfully, length:', token.length);
            
            return token;
        } catch (error) {
            console.error('[ERROR JWT] Generation error:', error);
            throw new Error('Failed to generate token');
        }
    }
    
    static verifyToken(token) {
        try {
            console.log('[DEBUG JWT] Verifying token');
            console.log('[DEBUG JWT] Token length:', token?.length);
            console.log('[DEBUG JWT] JWT_SECRET exists:', !!process.env.JWT_SECRET);
            console.log('[DEBUG JWT] JWT_SECRET length:', process.env.JWT_SECRET?.length);
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                issuer: 'taskflow-pro',
                audience: 'taskflow-users'
            });
            
            console.log('[DEBUG JWT] Token verified successfully:', {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                iat: decoded.iat,
                exp: decoded.exp
            });
            
            return decoded;
        } catch (error) {
            console.error('[ERROR JWT] Token verification failed:', {
                name: error.name,
                message: error.message,
                tokenLength: token?.length,
                jwtSecretExists: !!process.env.JWT_SECRET
            });
            
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            } else {
                throw new Error('Token verification failed');
            }
        }
    }
    
    static createSecureCookie(res, token) {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            path: '/'
        };
        
        res.cookie('auth_token', token, cookieOptions);
    }
    
    static clearCookie(res) {
        res.clearCookie('auth_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        });
    }
}

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        console.log('[DEBUG AUTH] Authenticating token');
        console.log('[DEBUG AUTH] Available cookies:', Object.keys(req.cookies || {}));
        console.log('[DEBUG AUTH] taskflow_token exists:', !!req.cookies?.taskflow_token);
        console.log('[DEBUG AUTH] auth_token exists:', !!req.cookies?.auth_token);
        
        // Get token from cookie or Authorization header
        let token = req.cookies.taskflow_token || req.cookies.auth_token;
        
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
                console.log('[DEBUG AUTH] Token from Authorization header');
            }
        } else {
            console.log('[DEBUG AUTH] Token from cookie:', token?.length, 'characters');
        }
        
        if (!token) {
            console.log('[DEBUG AUTH] No token found');
            return res.status(401).json({
                success: false,
                message: 'Access token required',
                code: 'NO_TOKEN'
            });
        }
        
        const decoded = JWTAuth.verifyToken(token);
        
        // Verify user still exists in database
        const userQuery = `
            SELECT id, email, role, full_name, is_active, last_login
            FROM users 
            WHERE id = $1 AND is_active = true
        `;
        
        const result = await Database.query(userQuery, [decoded.userId]);
        
        if (result.rows.length === 0) {
            JWTAuth.clearCookie(res);
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive',
                code: 'USER_NOT_FOUND'
            });
        }
        
        const user = result.rows[0];
        
        // Add user info to request object
        req.user = {
            userId: user.id,
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            lastLogin: user.last_login
        };
        
        next();
        
    } catch (error) {
        console.error('Authentication error:', error);
        
        JWTAuth.clearCookie(res);
        
        return res.status(401).json({
            success: false,
            message: error.message,
            code: 'AUTH_FAILED'
        });
    }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED'
            });
        }
        
        const userRole = req.user.role;
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        
        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: roles,
                current: userRole
            });
        }
        
        next();
    };
};

// Master user only middleware
const requireMaster = requireRole('master');

// Manager or higher middleware
const requireManager = requireRole(['master', 'manager']);

// Team Lead or higher middleware
const requireTeamLead = requireRole(['master', 'manager', 'team_lead']);

module.exports = {
    JWTAuth,
    authenticateToken,
    requireRole,
    requireMaster,
    requireManager,
    requireTeamLead
};