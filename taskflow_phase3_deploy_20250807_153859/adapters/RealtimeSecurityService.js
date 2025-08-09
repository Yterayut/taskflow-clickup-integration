/**
 * Real-time Security Service
 * TaskFlow Pro v3.0 - Phase 3 Security Implementation
 * Multi-Persona Ultra-Think Enhanced Security
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

class RealtimeSecurityService {
    constructor(config = {}) {
        this.config = {
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
            maxConnectionsPerIP: config.maxConnectionsPerIP || 10,
            maxMessagesPerMinute: config.maxMessagesPerMinute || 100,
            sessionTimeout: config.sessionTimeout || 24 * 60 * 60 * 1000, // 24 hours
            encryptionKey: config.encryptionKey || this.generateEncryptionKey(),
            allowedOrigins: config.allowedOrigins || [
                'http://192.168.20.10:8888',
                'http://localhost:8888',
                'http://localhost:3000',
                'http://localhost:5173'
            ],
            trustedProxies: config.trustedProxies || [],
            enableMessageEncryption: config.enableMessageEncryption !== false,
            enableInputSanitization: config.enableInputSanitization !== false,
            enableAuditLogging: config.enableAuditLogging !== false,
            ...config
        };

        // Security metrics and monitoring
        this.securityMetrics = {
            blockedConnections: 0,
            rateLimitedRequests: 0,
            invalidTokens: 0,
            suspiciousActivity: 0,
            encryptedMessages: 0,
            auditEvents: 0
        };

        // Active connections tracking
        this.activeConnections = new Map();
        this.ipConnections = new Map();
        this.rateLimiters = new Map();
        this.suspiciousIPs = new Set();
        this.bannedIPs = new Set();
        
        // Message validation patterns
        this.messagePatterns = {
            // SQL injection patterns
            sqlInjection: /(union|select|insert|update|delete|drop|create|alter|exec|execute)\s/i,
            // XSS patterns
            xss: /<script[^>]*>.*?<\/script>/gi,
            // Path traversal
            pathTraversal: /\.\.[\/\\]/,
            // Command injection
            commandInjection: /[;&|`$(){}\[\]]/
        };
        
        this.startSecurityMonitoring();
    }

    /**
     * Connection Authentication and Authorization
     */
    async authenticateConnection(request, socket) {
        try {
            const clientIP = this.getClientIP(request);
            const origin = request.headers.origin;
            const userAgent = request.headers['user-agent'];
            
            // Check if IP is banned
            if (this.bannedIPs.has(clientIP)) {
                this.logSecurityEvent('connection_blocked', {
                    ip: clientIP,
                    reason: 'banned_ip',
                    userAgent
                });
                throw new Error('Connection blocked: IP banned');
            }

            // Validate origin
            if (!this.validateOrigin(origin)) {
                this.logSecurityEvent('connection_blocked', {
                    ip: clientIP,
                    reason: 'invalid_origin',
                    origin,
                    userAgent
                });
                throw new Error('Connection blocked: Invalid origin');
            }

            // Check connection limits per IP
            if (this.checkConnectionLimit(clientIP)) {
                this.logSecurityEvent('connection_blocked', {
                    ip: clientIP,
                    reason: 'connection_limit_exceeded',
                    currentConnections: this.ipConnections.get(clientIP) || 0,
                    limit: this.config.maxConnectionsPerIP
                });
                throw new Error('Connection blocked: Too many connections from IP');
            }

            // Extract and validate authentication token
            const token = this.extractToken(request);
            if (!token) {
                this.logSecurityEvent('authentication_failed', {
                    ip: clientIP,
                    reason: 'no_token',
                    userAgent
                });
                throw new Error('Authentication required');
            }

            // Verify JWT token
            const decoded = await this.verifyToken(token);
            
            // Create secure session
            const sessionId = this.generateSessionId();
            const session = {
                id: sessionId,
                userId: decoded.userId || decoded.id,
                userRole: decoded.role,
                ip: clientIP,
                userAgent,
                origin,
                connectedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                messageCount: 0,
                isAuthenticated: true
            };

            // Track connection
            this.trackConnection(clientIP, sessionId, session);
            
            this.logSecurityEvent('connection_authenticated', {
                sessionId,
                userId: session.userId,
                ip: clientIP,
                userAgent
            });

            return { session, sessionId };

        } catch (error) {
            this.securityMetrics.blockedConnections++;
            throw error;
        }
    }

    /**
     * Message Security and Validation
     */
    async validateMessage(message, session) {
        try {
            // Rate limiting check
            if (this.checkRateLimit(session.id)) {
                this.logSecurityEvent('rate_limit_exceeded', {
                    sessionId: session.id,
                    userId: session.userId,
                    ip: session.ip
                });
                throw new Error('Rate limit exceeded');
            }

            // Input validation and sanitization
            const validatedMessage = this.validateAndSanitizeMessage(message);
            
            // Check for suspicious patterns
            this.detectSuspiciousActivity(validatedMessage, session);
            
            // Update session activity
            session.lastActivity = new Date().toISOString();
            session.messageCount++;
            
            this.activeConnections.set(session.id, session);
            
            return validatedMessage;

        } catch (error) {
            this.logSecurityEvent('message_validation_failed', {
                sessionId: session.id,
                userId: session.userId,
                error: error.message,
                messageType: message.type
            });
            throw error;
        }
    }

    validateAndSanitizeMessage(message) {
        if (!message || typeof message !== 'object') {
            throw new Error('Invalid message format');
        }

        // Required fields validation
        if (!message.type || typeof message.type !== 'string') {
            throw new Error('Message type is required');
        }

        // Sanitize message type
        message.type = this.sanitizeString(message.type);
        
        // Validate message type against whitelist
        const allowedMessageTypes = [
            'heartbeat', 'auth', 'subscribe-tasks', 'subscribe-team',
            'subscribe-analytics', 'join-room', 'leave-room',
            'task-update', 'user-activity', 'system-alert'
        ];
        
        if (!allowedMessageTypes.includes(message.type)) {
            throw new Error(`Invalid message type: ${message.type}`);
        }

        // Sanitize message data
        if (message.data && typeof message.data === 'object') {
            message.data = this.sanitizeObject(message.data);
        }

        // Check message size
        const messageSize = JSON.stringify(message).length;
        if (messageSize > 10 * 1024) { // 10KB limit
            throw new Error('Message too large');
        }

        // Validate timestamp
        if (message.timestamp) {
            const timestamp = new Date(message.timestamp);
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - timestamp.getTime());
            
            // Allow 5 minutes clock skew
            if (timeDiff > 5 * 60 * 1000) {
                throw new Error('Invalid timestamp');
            }
        }

        return message;
    }

    sanitizeString(str) {
        if (typeof str !== 'string') return str;
        
        // Remove potential XSS and injection patterns
        return str
            .replace(this.messagePatterns.xss, '')
            .replace(this.messagePatterns.sqlInjection, '')
            .replace(this.messagePatterns.commandInjection, '')
            .replace(this.messagePatterns.pathTraversal, '')
            .trim()
            .substring(0, 1000); // Limit length
    }

    sanitizeObject(obj, depth = 0) {
        if (depth > 10) return {}; // Prevent deep nesting attacks
        
        const sanitized = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const sanitizedKey = this.sanitizeString(key);
            
            if (typeof value === 'string') {
                sanitized[sanitizedKey] = this.sanitizeString(value);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[sanitizedKey] = this.sanitizeObject(value, depth + 1);
            } else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[sanitizedKey] = value;
            }
            // Skip other types (functions, symbols, etc.)
        }
        
        return sanitized;
    }

    /**
     * Message Encryption/Decryption
     */
    encryptMessage(message, sessionId) {
        if (!this.config.enableMessageEncryption) {
            return message;
        }

        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-gcm', this.config.encryptionKey);
            cipher.setAAD(Buffer.from(sessionId));
            
            let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            this.securityMetrics.encryptedMessages++;
            
            return {
                encrypted: true,
                data: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('[Security] Message encryption failed:', error);
            return message; // Fall back to unencrypted
        }
    }

    decryptMessage(encryptedMessage, sessionId) {
        if (!encryptedMessage.encrypted) {
            return encryptedMessage;
        }

        try {
            const decipher = crypto.createDecipher('aes-256-gcm', this.config.encryptionKey);
            decipher.setAAD(Buffer.from(sessionId));
            decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedMessage.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('[Security] Message decryption failed:', error);
            throw new Error('Message decryption failed');
        }
    }

    /**
     * Suspicious Activity Detection
     */
    detectSuspiciousActivity(message, session) {
        const suspiciousIndicators = [];
        
        // Check for rapid message sending
        if (session.messageCount > this.config.maxMessagesPerMinute) {
            suspiciousIndicators.push('rapid_messaging');
        }
        
        // Check for malicious patterns in message content
        const messageStr = JSON.stringify(message);
        Object.entries(this.messagePatterns).forEach(([pattern, regex]) => {
            if (regex.test(messageStr)) {
                suspiciousIndicators.push(`malicious_pattern_${pattern}`);
            }
        });
        
        // Check for unusual message types
        if (message.type && !this.isValidMessageType(message.type)) {
            suspiciousIndicators.push('invalid_message_type');
        }
        
        // Check for session hijacking attempts
        if (this.detectSessionHijacking(session)) {
            suspiciousIndicators.push('session_hijacking');
        }
        
        if (suspiciousIndicators.length > 0) {
            this.handleSuspiciousActivity(session, suspiciousIndicators);
        }
    }

    handleSuspiciousActivity(session, indicators) {
        this.securityMetrics.suspiciousActivity++;
        
        this.logSecurityEvent('suspicious_activity_detected', {
            sessionId: session.id,
            userId: session.userId,
            ip: session.ip,
            indicators,
            severity: this.calculateSuspicionLevel(indicators)
        });
        
        // Add IP to suspicious list
        this.suspiciousIPs.add(session.ip);
        
        // Escalate if multiple indicators
        if (indicators.length >= 3) {
            this.banIP(session.ip, 'Multiple suspicious activities');
        }
    }

    /**
     * Utility Methods
     */
    extractToken(request) {
        // Check URL parameters first
        const url = new URL(request.url, 'ws://localhost');
        const tokenFromUrl = url.searchParams.get('token');
        if (tokenFromUrl) return tokenFromUrl;
        
        // Check headers
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        
        return null;
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.config.jwtSecret);
            
            // Check token expiration
            if (decoded.exp && decoded.exp < Date.now() / 1000) {
                throw new Error('Token expired');
            }
            
            return decoded;
        } catch (error) {
            this.securityMetrics.invalidTokens++;
            throw new Error('Invalid token');
        }
    }

    validateOrigin(origin) {
        if (!origin) return false;
        return this.config.allowedOrigins.includes(origin);
    }

    getClientIP(request) {
        // Check for forwarded headers from trusted proxies
        const forwardedFor = request.headers['x-forwarded-for'];
        if (forwardedFor && this.config.trustedProxies.length > 0) {
            const ips = forwardedFor.split(',').map(ip => ip.trim());
            return ips[0];
        }
        
        return request.headers['x-real-ip'] || 
               request.connection.remoteAddress || 
               request.socket.remoteAddress;
    }

    checkConnectionLimit(ip) {
        const currentConnections = this.ipConnections.get(ip) || 0;
        return currentConnections >= this.config.maxConnectionsPerIP;
    }

    checkRateLimit(sessionId) {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        if (!this.rateLimiters.has(sessionId)) {
            this.rateLimiters.set(sessionId, []);
        }
        
        const requests = this.rateLimiters.get(sessionId);
        
        // Remove old requests outside the window
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        
        // Add current request
        validRequests.push(now);
        this.rateLimiters.set(sessionId, validRequests);
        
        return validRequests.length > this.config.maxMessagesPerMinute;
    }

    trackConnection(ip, sessionId, session) {
        // Track by IP
        const currentIpConnections = this.ipConnections.get(ip) || 0;
        this.ipConnections.set(ip, currentIpConnections + 1);
        
        // Track by session
        this.activeConnections.set(sessionId, session);
    }

    removeConnection(sessionId) {
        const session = this.activeConnections.get(sessionId);
        if (session) {
            // Update IP connection count
            const currentIpConnections = this.ipConnections.get(session.ip) || 0;
            if (currentIpConnections > 0) {
                this.ipConnections.set(session.ip, currentIpConnections - 1);
            }
            
            // Remove session
            this.activeConnections.delete(sessionId);
            this.rateLimiters.delete(sessionId);
            
            this.logSecurityEvent('connection_closed', {
                sessionId,
                userId: session.userId,
                ip: session.ip,
                duration: Date.now() - new Date(session.connectedAt).getTime()
            });
        }
    }

    banIP(ip, reason) {
        this.bannedIPs.add(ip);
        this.logSecurityEvent('ip_banned', { ip, reason });
        
        // Auto-unban after 1 hour
        setTimeout(() => {
            this.bannedIPs.delete(ip);
            this.logSecurityEvent('ip_unbanned', { ip, reason: 'auto_unban' });
        }, 60 * 60 * 1000);
    }

    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateEncryptionKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    isValidMessageType(type) {
        const validTypes = [
            'heartbeat', 'auth', 'subscribe-tasks', 'subscribe-team',
            'subscribe-analytics', 'join-room', 'leave-room',
            'task-update', 'user-activity', 'system-alert'
        ];
        return validTypes.includes(type);
    }

    detectSessionHijacking(session) {
        // Simple heuristics for session hijacking detection
        const previousSession = this.activeConnections.get(session.id);
        if (!previousSession) return false;
        
        // Check for IP changes
        if (previousSession.ip !== session.ip) {
            return true;
        }
        
        // Check for user agent changes
        if (previousSession.userAgent !== session.userAgent) {
            return true;
        }
        
        return false;
    }

    calculateSuspicionLevel(indicators) {
        if (indicators.length >= 5) return 'critical';
        if (indicators.length >= 3) return 'high';
        if (indicators.length >= 2) return 'medium';
        return 'low';
    }

    /**
     * Security Monitoring and Logging
     */
    startSecurityMonitoring() {
        // Clean up old sessions and rate limit data
        setInterval(() => {
            this.cleanupExpiredSessions();
            this.cleanupRateLimitData();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Security metrics reporting
        setInterval(() => {
            this.reportSecurityMetrics();
        }, 15 * 60 * 1000); // Every 15 minutes
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        const expiredSessions = [];
        
        this.activeConnections.forEach((session, sessionId) => {
            const lastActivity = new Date(session.lastActivity).getTime();
            if (now - lastActivity > this.config.sessionTimeout) {
                expiredSessions.push(sessionId);
            }
        });
        
        expiredSessions.forEach(sessionId => {
            this.removeConnection(sessionId);
        });
    }

    cleanupRateLimitData() {
        const now = Date.now();
        const windowStart = now - 60000;
        
        this.rateLimiters.forEach((requests, sessionId) => {
            const validRequests = requests.filter(timestamp => timestamp > windowStart);
            if (validRequests.length === 0) {
                this.rateLimiters.delete(sessionId);
            } else {
                this.rateLimiters.set(sessionId, validRequests);
            }
        });
    }

    logSecurityEvent(eventType, data) {
        if (!this.config.enableAuditLogging) return;
        
        const event = {
            timestamp: new Date().toISOString(),
            type: eventType,
            data,
            source: 'RealtimeSecurityService'
        };
        
        console.log(`[SECURITY] ${eventType}:`, JSON.stringify(data));
        this.securityMetrics.auditEvents++;
        
        // In production, send to audit logging service
    }

    reportSecurityMetrics() {
        console.log('[SECURITY METRICS]', {
            ...this.securityMetrics,
            activeConnections: this.activeConnections.size,
            suspiciousIPs: this.suspiciousIPs.size,
            bannedIPs: this.bannedIPs.size,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Public API
     */
    getSecurityMetrics() {
        return {
            ...this.securityMetrics,
            activeConnections: this.activeConnections.size,
            suspiciousIPs: this.suspiciousIPs.size,
            bannedIPs: this.bannedIPs.size,
            rateLimiters: this.rateLimiters.size
        };
    }

    getActiveConnections() {
        return Array.from(this.activeConnections.values());
    }

    getSuspiciousIPs() {
        return Array.from(this.suspiciousIPs);
    }

    getBannedIPs() {
        return Array.from(this.bannedIPs);
    }

    // Admin functions
    unbanIP(ip) {
        this.bannedIPs.delete(ip);
        this.logSecurityEvent('ip_unbanned', { ip, reason: 'manual_unban' });
    }

    clearSuspiciousIP(ip) {
        this.suspiciousIPs.delete(ip);
        this.logSecurityEvent('suspicious_ip_cleared', { ip });
    }

    forceDisconnectSession(sessionId) {
        const session = this.activeConnections.get(sessionId);
        if (session) {
            this.removeConnection(sessionId);
            this.logSecurityEvent('session_force_disconnected', {
                sessionId,
                userId: session.userId,
                ip: session.ip
            });
            return true;
        }
        return false;
    }
}

module.exports = { RealtimeSecurityService };