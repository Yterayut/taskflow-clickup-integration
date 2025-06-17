const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthService {
    constructor(redisClient = null) {
        this.redis = redisClient;
        this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
        this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-characters-long';
        // Memory storage fallback when Redis is not available
        this.memoryStore = {
            sessions: new Map(),
            tokens: new Map(),
            oauthStates: new Map()
        };
    }

    // Token Management
    generateSessionToken(userId, userData = {}) {
        const payload = {
            userId,
            userData,
            timestamp: Date.now()
        };
        
        return jwt.sign(payload, this.jwtSecret, { 
            expiresIn: '24h',
            issuer: 'TaskFlow'
        });
    }

    verifySessionToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid session token');
        }
    }

    // Access Token Encryption/Decryption
    encryptAccessToken(accessToken) {
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(this.encryptionKey, 'utf8');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, key);
        let encrypted = cipher.update(accessToken, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted,
            iv: iv.toString('hex')
        };
    }

    decryptAccessToken(encryptedData) {
        const algorithm = 'aes-256-cbc';
        const key = Buffer.from(this.encryptionKey, 'utf8');
        
        const decipher = crypto.createDecipher(algorithm, key);
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    // Session Storage (Redis)
    async storeUserSession(userId, sessionData) {
        if (this.redis) {
            try {
                const sessionKey = `session:${userId}`;
                const sessionJson = JSON.stringify(sessionData);
                await this.redis.setEx(sessionKey, 86400, sessionJson); // 24 hours
                return true;
            } catch (error) {
                console.error('Error storing user session in Redis:', error);
                // Fall back to memory storage
            }
        }
        
        // Memory storage fallback
        this.memoryStore.sessions.set(userId, {
            ...sessionData,
            expiresAt: Date.now() + 86400000 // 24 hours
        });
        
        return true;
    }

    async getUserSession(userId) {
        if (this.redis) {
            try {
                const sessionKey = `session:${userId}`;
                const sessionJson = await this.redis.get(sessionKey);
                if (sessionJson) {
                    return JSON.parse(sessionJson);
                }
            } catch (error) {
                console.error('Error retrieving user session from Redis:', error);
                // Fall back to memory storage
            }
        }
        
        // Memory storage fallback
        const sessionData = this.memoryStore.sessions.get(userId);
        if (!sessionData) return null;
        
        // Check expiration
        if (Date.now() > sessionData.expiresAt) {
            this.memoryStore.sessions.delete(userId);
            return null;
        }
        
        return sessionData;
    }

    async removeUserSession(userId) {
        if (!this.redis) {
            return true; // Silently succeed if Redis not available
        }

        const sessionKey = `session:${userId}`;
        
        try {
            await this.redis.del(sessionKey);
            return true;
        } catch (error) {
            console.error('Error removing user session:', error);
            return false;
        }
    }

    // ClickUp Token Storage
    async storeClickUpTokens(userId, tokenData) {
        if (!this.redis) {
            throw new Error('Redis client not available for token storage');
        }

        // Encrypt access token
        const encryptedToken = this.encryptAccessToken(tokenData.access_token);
        
        const tokenRecord = {
            access_token: encryptedToken,
            token_type: tokenData.token_type || 'Bearer',
            scope: tokenData.scope,
            created_at: Date.now(),
            user_id: userId
        };

        const tokenKey = `clickup_token:${userId}`;
        
        try {
            await this.redis.setEx(tokenKey, 2592000, JSON.stringify(tokenRecord)); // 30 days
            return true;
        } catch (error) {
            console.error('Error storing ClickUp tokens:', error);
            throw new Error('Failed to store ClickUp tokens');
        }
    }

    async getClickUpTokens(userId) {
        if (!this.redis) {
            throw new Error('Redis client not available for token retrieval');
        }

        const tokenKey = `clickup_token:${userId}`;
        
        try {
            const tokenJson = await this.redis.get(tokenKey);
            if (!tokenJson) return null;

            const tokenRecord = JSON.parse(tokenJson);
            
            // Decrypt access token
            const decryptedToken = this.decryptAccessToken(tokenRecord.access_token);
            
            return {
                access_token: decryptedToken,
                token_type: tokenRecord.token_type,
                scope: tokenRecord.scope,
                created_at: tokenRecord.created_at
            };
        } catch (error) {
            console.error('Error retrieving ClickUp tokens:', error);
            return null;
        }
    }

    async removeClickUpTokens(userId) {
        if (!this.redis) {
            return true;
        }

        const tokenKey = `clickup_token:${userId}`;
        
        try {
            await this.redis.del(tokenKey);
            return true;
        } catch (error) {
            console.error('Error removing ClickUp tokens:', error);
            return false;
        }
    }

    // OAuth State Management
    generateOAuthState() {
        return crypto.randomBytes(32).toString('hex');
    }

    async storeOAuthState(state, userId = null) {
        const stateData = {
            created_at: Date.now(),
            user_id: userId
        };
        
        if (this.redis) {
            try {
                const stateKey = `oauth_state:${state}`;
                await this.redis.setEx(stateKey, 600, JSON.stringify(stateData)); // 10 minutes
                return true;
            } catch (error) {
                console.error('Error storing OAuth state in Redis:', error);
                // Fall back to memory storage
            }
        }
        
        // Memory storage fallback
        this.memoryStore.oauthStates.set(state, {
            ...stateData,
            expiresAt: Date.now() + 600000 // 10 minutes
        });
        
        // Clean up expired states
        this.cleanupExpiredStates();
        return true;
    }

    async verifyOAuthState(state) {
        if (this.redis) {
            try {
                const stateKey = `oauth_state:${state}`;
                const stateJson = await this.redis.get(stateKey);
                if (stateJson) {
                    await this.redis.del(stateKey);
                    const stateData = JSON.parse(stateJson);
                    const now = Date.now();
                    const tenMinutes = 10 * 60 * 1000;
                    return (now - stateData.created_at) < tenMinutes;
                }
            } catch (error) {
                console.error('Error verifying OAuth state in Redis:', error);
            }
        }
        
        // Memory storage fallback
        const stateData = this.memoryStore.oauthStates.get(state);
        if (!stateData) return false;
        
        this.memoryStore.oauthStates.delete(state);
        const now = Date.now();
        return now <= stateData.expiresAt;
    }
    
    cleanupExpiredStates() {
        const now = Date.now();
        for (const [state, data] of this.memoryStore.oauthStates.entries()) {
            if (now > data.expiresAt) {
                this.memoryStore.oauthStates.delete(state);
            }
        }
    }

    // User Authentication Status
    async isUserAuthenticated(userId) {
        const session = await this.getUserSession(userId);
        const tokens = await this.getClickUpTokens(userId);
        
        return !!(session && tokens);
    }

    async getUserAuthStatus(userId) {
        const session = await this.getUserSession(userId);
        const tokens = await this.getClickUpTokens(userId);
        
        return {
            authenticated: !!(session && tokens),
            hasSession: !!session,
            hasTokens: !!tokens,
            sessionCreated: session?.created_at,
            tokensCreated: tokens?.created_at
        };
    }

    // Middleware for protecting routes
    requireAuth() {
        return async (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({ 
                    error: 'No authorization token provided',
                    code: 'NO_TOKEN'
                });
            }

            try {
                const decoded = this.verifySessionToken(token);
                const authStatus = await this.getUserAuthStatus(decoded.userId);
                
                if (!authStatus.authenticated) {
                    return res.status(401).json({ 
                        error: 'User not authenticated with ClickUp',
                        code: 'NOT_AUTHENTICATED'
                    });
                }

                req.user = decoded;
                req.userId = decoded.userId;
                next();
            } catch (error) {
                return res.status(401).json({ 
                    error: 'Invalid or expired token',
                    code: 'INVALID_TOKEN'
                });
            }
        };
    }

    // Clean expired sessions and tokens
    async cleanupExpiredSessions() {
        if (!this.redis) return;

        try {
            const keys = await this.redis.keys('session:*');
            const expiredKeys = [];
            
            for (const key of keys) {
                const ttl = await this.redis.ttl(key);
                if (ttl === -1) { // No expiration set
                    expiredKeys.push(key);
                }
            }
            
            if (expiredKeys.length > 0) {
                await this.redis.del(expiredKeys);
                console.log(`Cleaned up ${expiredKeys.length} expired sessions`);
            }
        } catch (error) {
            console.error('Error cleaning up expired sessions:', error);
        }
    }
}

module.exports = AuthService;