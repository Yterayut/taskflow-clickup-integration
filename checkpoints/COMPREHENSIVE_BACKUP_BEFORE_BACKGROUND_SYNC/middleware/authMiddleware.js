/**
 * Authentication Middleware for TaskFlow Pro
 * Handles JWT authentication and permission-based access control
 */

/**
 * JWT Authentication Middleware
 * Validates JWT token and adds user info to request object
 */
async function requireJWT(req, res, next) {
    try {
        const jwtService = req.app.get('jwtService');
        
        if (!jwtService) {
            return res.status(503).json({
                success: false,
                error: 'JWT service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        // Get token from Authorization header or cookies
        let token = null;
        
        // Check Authorization header first (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        
        // Check cookies if no Authorization header
        if (!token && req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication token required',
                code: 'TOKEN_REQUIRED'
            });
        }

        // Validate token
        const decoded = await jwtService.verifyToken(token);
        
        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
            });
        }

        // Add user info to request
        req.user = decoded;
        req.userId = decoded.userId;
        
        next();
        
    } catch (error) {
        console.error('❌ JWT authentication error:', error);
        return res.status(401).json({
            success: false,
            error: 'Authentication failed',
            code: 'AUTH_FAILED'
        });
    }
}

/**
 * Permission-based Authorization Middleware
 * Checks if user has required permissions
 */
function requirePermission(permission) {
    return async (req, res, next) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'User authentication required',
                    code: 'USER_REQUIRED'
                });
            }

            // Check for admin permission
            if (permission === 'admin') {
                // Check if user has admin role or is master user
                const masterUserEmail = process.env.MASTER_USER_EMAIL;
                
                if (user.email === masterUserEmail || 
                    user.role === 'admin' || 
                    user.role === 'master' ||
                    user.permissions?.includes('admin')) {
                    return next();
                }
                
                return res.status(403).json({
                    success: false,
                    error: 'Administrator access required',
                    code: 'ADMIN_REQUIRED'
                });
            }

            // Check for manager permission
            if (permission === 'manager') {
                if (user.role === 'manager' || 
                    user.role === 'admin' || 
                    user.role === 'master' ||
                    user.permissions?.includes('manager')) {
                    return next();
                }
                
                return res.status(403).json({
                    success: false,
                    error: 'Manager access required',
                    code: 'MANAGER_REQUIRED'
                });
            }

            // Check for team lead permission
            if (permission === 'teamlead') {
                if (user.role === 'teamlead' || 
                    user.role === 'manager' || 
                    user.role === 'admin' || 
                    user.role === 'master' ||
                    user.permissions?.includes('teamlead')) {
                    return next();
                }
                
                return res.status(403).json({
                    success: false,
                    error: 'Team lead access required',
                    code: 'TEAMLEAD_REQUIRED'
                });
            }

            // Check for general permissions
            if (user.permissions?.includes(permission)) {
                return next();
            }

            return res.status(403).json({
                success: false,
                error: `Permission '${permission}' required`,
                code: 'PERMISSION_DENIED'
            });
            
        } catch (error) {
            console.error('❌ Permission check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Permission check failed',
                code: 'PERMISSION_ERROR'
            });
        }
    };
}

/**
 * Rate Limiting Middleware (optional)
 * Basic rate limiting for sensitive endpoints
 */
function rateLimit(options = {}) {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 100, // limit each IP to 100 requests per windowMs
        message = 'Too many requests from this IP'
    } = options;

    const requests = new Map();

    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        // Clean up old entries
        for (const [key, data] of requests.entries()) {
            if (now - data.timestamp > windowMs) {
                requests.delete(key);
            }
        }

        // Check current requests
        const current = requests.get(ip);
        if (current) {
            if (now - current.timestamp < windowMs && current.count >= max) {
                return res.status(429).json({
                    success: false,
                    error: message,
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: Math.ceil((windowMs - (now - current.timestamp)) / 1000)
                });
            }
            
            if (now - current.timestamp < windowMs) {
                current.count++;
            } else {
                requests.set(ip, { count: 1, timestamp: now });
            }
        } else {
            requests.set(ip, { count: 1, timestamp: now });
        }

        next();
    };
}

/**
 * Optional user middleware (doesn't require authentication)
 * Adds user info if available but doesn't block if not authenticated
 */
async function optionalUser(req, res, next) {
    try {
        const jwtService = req.app.get('jwtService');
        
        if (!jwtService) {
            return next(); // Continue without user info
        }

        // Get token from Authorization header or cookies
        let token = null;
        
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        
        if (!token && req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        }
        
        if (token) {
            try {
                const decoded = await jwtService.verifyToken(token);
                if (decoded) {
                    req.user = decoded;
                    req.userId = decoded.userId;
                }
            } catch (error) {
                // Ignore errors, just continue without user info
            }
        }
        
        next();
        
    } catch (error) {
        // Continue without user info on any error
        next();
    }
}

module.exports = {
    requireJWT,
    requirePermission,
    rateLimit,
    optionalUser
};