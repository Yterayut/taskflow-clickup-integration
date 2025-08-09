/**
 * JWT Service Adapter
 * Handles JWT token generation, verification, and management
 */
const jwt = require('jsonwebtoken');

class JWTService {
    constructor() {
        this.secret = process.env.JWT_SECRET;
        this.issuer = 'taskflow-pro';
        this.audience = 'taskflow-users';
        
        if (!this.secret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
    }
    
    /**
     * Generate JWT token for user or payload
     */
    generateToken(userOrPayload, expiresIn = '24h') {
        try {
            // Enhanced payload generation with proper userId handling
            let payload;
            
            // Check if this is a direct payload object with userId
            if (userOrPayload.userId && userOrPayload.email) {
                // Direct payload from authentication service
                payload = {
                    sub: userOrPayload.userId,
                    userId: userOrPayload.userId,
                    email: userOrPayload.email,
                    role: userOrPayload.role,
                    capabilities: userOrPayload.capabilities || {},
                    displayName: userOrPayload.displayName,
                    iat: Math.floor(Date.now() / 1000)
                };
            } else if (userOrPayload.id) {
                // User entity object
                payload = {
                    sub: userOrPayload.id, // Subject (user ID)
                    userId: userOrPayload.id,
                    email: userOrPayload.email ? userOrPayload.email.toString() : userOrPayload.email,
                    role: userOrPayload.role ? userOrPayload.role.toString() : userOrPayload.role,
                    capabilities: userOrPayload.getCapabilities ? userOrPayload.getCapabilities() : {},
                    displayName: userOrPayload.role ? userOrPayload.role.getDisplayName() : userOrPayload.displayName,
                    iat: Math.floor(Date.now() / 1000), // Issued at
                    fullName: userOrPayload.fullName
                };
            } else {
                // Fallback: assume it's a simple object, construct minimal payload
                payload = {
                    sub: userOrPayload.userId || userOrPayload.id,
                    userId: userOrPayload.userId || userOrPayload.id,
                    email: userOrPayload.email,
                    role: userOrPayload.role,
                    capabilities: userOrPayload.capabilities || {},
                    displayName: userOrPayload.displayName,
                    iat: Math.floor(Date.now() / 1000)
                };
            }
            
            const options = {
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: expiresIn,
                algorithm: 'HS256'
            };
            
            return jwt.sign(payload, this.secret, options);
        } catch (error) {
            console.error('JWT generation error:', error);
            throw new Error('Failed to generate JWT token');
        }
    }
    
    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            const options = {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: ['HS256']
            };
            
            const decoded = jwt.verify(token, this.secret, options);
            
            // Additional validation
            this.validateTokenPayload(decoded);
            
            return decoded;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Token has expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            } else if (error instanceof jwt.NotBeforeError) {
                throw new Error('Token not active yet');
            } else {
                console.error('JWT verification error:', error);
                throw new Error('Token verification failed');
            }
        }
    }
    
    /**
     * Validate token payload structure
     */
    validateTokenPayload(payload) {
        const required = ['sub', 'email', 'role', 'iat'];
        const missing = required.filter(key => !payload[key]);
        
        if (missing.length > 0) {
            throw new Error(`Invalid token payload: missing ${missing.join(', ')}`);
        }
        
        // Validate role
        const validRoles = ['master', 'manager', 'team_lead', 'employee', 'user'];
        if (!validRoles.includes(payload.role)) {
            throw new Error('Invalid role in token');
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.email)) {
            throw new Error('Invalid email format in token');
        }
    }
    
    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token) {
        try {
            return jwt.decode(token, { complete: true });
        } catch (error) {
            throw new Error('Failed to decode token');
        }
    }
    
    /**
     * Check if token is expired
     */
    isTokenExpired(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            
            return Date.now() >= decoded.exp * 1000;
        } catch (error) {
            return true;
        }
    }
    
    /**
     * Get token expiration time
     */
    getTokenExpiration(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) {
                return null;
            }
            
            return new Date(decoded.exp * 1000);
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Get time until token expires (in minutes)
     */
    getTimeUntilExpiry(token) {
        const expiration = this.getTokenExpiration(token);
        if (!expiration) {
            return 0;
        }
        
        const diffMs = expiration.getTime() - Date.now();
        return Math.max(0, Math.floor(diffMs / (1000 * 60)));
    }
    
    /**
     * Refresh token (generate new token with same payload but extended expiry)
     */
    refreshToken(token, newExpiresIn = '24h') {
        try {
            const payload = this.verifyToken(token);
            
            // Remove standard JWT claims that will be regenerated
            delete payload.iat;
            delete payload.exp;
            delete payload.nbf;
            delete payload.aud;
            delete payload.iss;
            
            // Generate new token with same payload
            return this.generateTokenFromPayload(payload, newExpiresIn);
        } catch (error) {
            throw new Error('Failed to refresh token');
        }
    }
    
    /**
     * Generate token from existing payload
     */
    generateTokenFromPayload(payload, expiresIn = '24h') {
        try {
            const options = {
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: expiresIn,
                algorithm: 'HS256'
            };
            
            return jwt.sign(payload, this.secret, options);
        } catch (error) {
            throw new Error('Failed to generate token from payload');
        }
    }
    
    /**
     * Create a short-lived token (for password reset, email verification, etc.)
     */
    generateShortLivedToken(payload, expiresIn = '1h') {
        try {
            const options = {
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: expiresIn,
                algorithm: 'HS256'
            };
            
            return jwt.sign(payload, this.secret, options);
        } catch (error) {
            throw new Error('Failed to generate short-lived token');
        }
    }
    
    /**
     * Validate token structure without full verification
     */
    isValidTokenStructure(token) {
        try {
            if (!token || typeof token !== 'string') {
                return false;
            }
            
            const parts = token.split('.');
            if (parts.length !== 3) {
                return false;
            }
            
            // Try to decode without verification
            const decoded = jwt.decode(token);
            return decoded !== null;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader || typeof authHeader !== 'string') {
            return null;
        }
        
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }
        
        return parts[1];
    }
    
    /**
     * Create middleware function for Express
     */
    createMiddleware() {
        return (req, res, next) => {
            try {
                // Try to get token from cookies first (HttpOnly)
                let token = req.cookies?.auth_token || req.cookies?.taskflow_token;
                
                // Fallback to Authorization header
                if (!token) {
                    token = this.extractTokenFromHeader(req.headers.authorization);
                }
                
                if (!token) {
                    return res.status(401).json({ 
                        error: 'Access token required',
                        code: 'TOKEN_MISSING'
                    });
                }
                
                const payload = this.verifyToken(token);
                req.user = {
                    id: payload.sub,
                    userId: payload.userId || payload.sub,
                    email: payload.email,
                    role: payload.role,
                    capabilities: payload.capabilities,
                    displayName: payload.displayName,
                    fullName: payload.fullName
                };
                
                next();
            } catch (error) {
                return res.status(401).json({ 
                    error: error.message,
                    code: 'TOKEN_INVALID'
                });
            }
        };
    }
}

module.exports = { JWTService };