/**
 * Comprehensive Audit Logging Service
 * Phase 1 Week 2 Implementation
 * 
 * Provides complete audit trail for all security events, user actions,
 * and system activities with advanced analytics and reporting capabilities
 */

const path = require('path');
const fs = require('fs').promises;

class AuditLoggingService {
    constructor(dbClient) {
        this.dbClient = dbClient;
        this.initialized = false;
        
        // Event types for comprehensive logging
        this.eventTypes = {
            // Authentication Events
            LOGIN_SUCCESS: 'login_success',
            LOGIN_FAILED: 'login_failed',
            LOGOUT: 'logout',
            SESSION_EXPIRED: 'session_expired',
            
            // Security Events
            ACCOUNT_LOCKED: 'account_locked',
            ACCOUNT_UNLOCKED: 'account_unlocked',
            PASSWORD_CHANGED: 'password_changed',
            SECURITY_VIOLATION: 'security_violation',
            
            // Admin Actions
            ADMIN_ACCESS: 'admin_access',
            USER_CREATED: 'user_created',
            USER_DELETED: 'user_deleted',
            PERMISSION_CHANGED: 'permission_changed',
            
            // System Events
            SYSTEM_STARTUP: 'system_startup',
            SYSTEM_SHUTDOWN: 'system_shutdown',
            DATABASE_ERROR: 'database_error',
            API_ERROR: 'api_error',
            
            // Data Access
            DATA_ACCESS: 'data_access',
            DATA_EXPORT: 'data_export',
            SENSITIVE_DATA_VIEW: 'sensitive_data_view'
        };

        // Risk levels for events
        this.riskLevels = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };
    }

    /**
     * Initialize audit logging service
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            // Create audit_logs table if not exists
            await this.createAuditTable();
            this.initialized = true;
            console.log('📋 AuditLoggingService initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize AuditLoggingService:', error);
            throw error;
        }
    }

    /**
     * Create audit logs table
     */
    async createAuditTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                event_id VARCHAR(255) UNIQUE NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                event_category VARCHAR(50) NOT NULL,
                risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
                user_id INTEGER,
                user_email VARCHAR(255),
                user_role VARCHAR(50),
                ip_address INET,
                user_agent TEXT,
                session_id VARCHAR(255),
                event_data JSONB,
                event_description TEXT,
                success BOOLEAN NOT NULL DEFAULT true,
                error_message TEXT,
                duration_ms INTEGER,
                resource_accessed VARCHAR(255),
                api_endpoint VARCHAR(255),
                http_method VARCHAR(10),
                response_code INTEGER,
                correlation_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await this.dbClient.query(createTableSQL);

        // Create indexes separately
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs (event_type);',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs (user_email);',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs (risk_level);',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs (correlation_id);'
        ];

        for (const indexSQL of indexes) {
            try {
                await this.dbClient.query(indexSQL);
            } catch (error) {
                console.warn('⚠️  Failed to create index:', error.message);
            }
        }
    }

    /**
     * Log a comprehensive audit event
     */
    async logEvent({
        eventType,
        userId = null,
        userEmail = null,
        userRole = null,
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        eventData = {},
        description = null,
        success = true,
        errorMessage = null,
        duration = null,
        resourceAccessed = null,
        apiEndpoint = null,
        httpMethod = null,
        responseCode = null,
        correlationId = null,
        riskLevel = this.riskLevels.LOW,
        req = null
    }) {
        try {
            // Generate unique event ID
            const eventId = this.generateEventId();
            const eventCategory = this.getEventCategory(eventType);

            // Extract additional data from request if provided
            if (req) {
                ipAddress = ipAddress || req.ip || req.connection.remoteAddress;
                userAgent = userAgent || req.get('User-Agent');
                apiEndpoint = apiEndpoint || req.originalUrl;
                httpMethod = httpMethod || req.method;
                sessionId = sessionId || req.sessionID;
                
                // Extract user info from request
                if (req.user) {
                    userId = userId || req.user.userId;
                    userEmail = userEmail || req.user.email;
                    userRole = userRole || req.user.role;
                }
            }

            // Enhanced event data
            const enhancedEventData = {
                ...eventData,
                timestamp: new Date().toISOString(),
                server_info: {
                    node_version: process.version,
                    uptime: process.uptime(),
                    memory_usage: process.memoryUsage()
                }
            };

            const auditEntry = {
                eventId,
                eventType,
                eventCategory,
                riskLevel,
                userId,
                userEmail,
                userRole,
                ipAddress,
                userAgent,
                sessionId,
                eventData: enhancedEventData,
                eventDescription: description || this.generateDescription(eventType, eventData),
                success,
                errorMessage,
                durationMs: duration,
                resourceAccessed,
                apiEndpoint,
                httpMethod,
                responseCode,
                correlationId: correlationId || this.generateCorrelationId()
            };

            // Insert into database
            const insertSQL = `
                INSERT INTO audit_logs (
                    event_id, event_type, event_category, risk_level,
                    user_id, user_email, user_role, ip_address, user_agent, session_id,
                    event_data, event_description, success, error_message, duration_ms,
                    resource_accessed, api_endpoint, http_method, response_code, correlation_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            `;

            const values = [
                auditEntry.eventId, auditEntry.eventType, auditEntry.eventCategory, auditEntry.riskLevel,
                auditEntry.userId, auditEntry.userEmail, auditEntry.userRole, auditEntry.ipAddress, 
                auditEntry.userAgent, auditEntry.sessionId, JSON.stringify(auditEntry.eventData),
                auditEntry.eventDescription, auditEntry.success, auditEntry.errorMessage, auditEntry.durationMs,
                auditEntry.resourceAccessed, auditEntry.apiEndpoint, auditEntry.httpMethod, 
                auditEntry.responseCode, auditEntry.correlationId
            ];

            await this.dbClient.query(insertSQL, values);

            // Log high-risk events to console for immediate attention
            if (riskLevel === this.riskLevels.HIGH || riskLevel === this.riskLevels.CRITICAL) {
                console.warn(`🚨 ${riskLevel.toUpperCase()} SECURITY EVENT:`, {
                    eventType,
                    userEmail,
                    ipAddress,
                    description: auditEntry.eventDescription
                });
            }

            return eventId;

        } catch (error) {
            console.error('❌ Failed to log audit event:', error);
            // Don't throw - logging should never break the main application
            return null;
        }
    }

    /**
     * Get event category based on event type
     */
    getEventCategory(eventType) {
        const categoryMap = {
            [this.eventTypes.LOGIN_SUCCESS]: 'authentication',
            [this.eventTypes.LOGIN_FAILED]: 'authentication',
            [this.eventTypes.LOGOUT]: 'authentication',
            [this.eventTypes.SESSION_EXPIRED]: 'authentication',
            
            [this.eventTypes.ACCOUNT_LOCKED]: 'security',
            [this.eventTypes.ACCOUNT_UNLOCKED]: 'security',
            [this.eventTypes.PASSWORD_CHANGED]: 'security',
            [this.eventTypes.SECURITY_VIOLATION]: 'security',
            
            [this.eventTypes.ADMIN_ACCESS]: 'administration',
            [this.eventTypes.USER_CREATED]: 'administration',
            [this.eventTypes.USER_DELETED]: 'administration',
            [this.eventTypes.PERMISSION_CHANGED]: 'administration',
            
            [this.eventTypes.SYSTEM_STARTUP]: 'system',
            [this.eventTypes.SYSTEM_SHUTDOWN]: 'system',
            [this.eventTypes.DATABASE_ERROR]: 'system',
            [this.eventTypes.API_ERROR]: 'system',
            
            [this.eventTypes.DATA_ACCESS]: 'data',
            [this.eventTypes.DATA_EXPORT]: 'data',
            [this.eventTypes.SENSITIVE_DATA_VIEW]: 'data'
        };

        return categoryMap[eventType] || 'general';
    }

    /**
     * Generate auto description for events
     */
    generateDescription(eventType, eventData) {
        const descriptions = {
            [this.eventTypes.LOGIN_SUCCESS]: `User successfully authenticated`,
            [this.eventTypes.LOGIN_FAILED]: `Failed authentication attempt`,
            [this.eventTypes.ACCOUNT_LOCKED]: `Account locked due to multiple failed attempts`,
            [this.eventTypes.ACCOUNT_UNLOCKED]: `Account unlocked by administrator`,
            [this.eventTypes.ADMIN_ACCESS]: `Administrator accessed sensitive functionality`,
            [this.eventTypes.DATA_EXPORT]: `Data export operation performed`,
            [this.eventTypes.SECURITY_VIOLATION]: `Security policy violation detected`
        };

        let baseDescription = descriptions[eventType] || `Event: ${eventType}`;
        
        // Add context from event data
        if (eventData.resource) {
            baseDescription += ` on resource: ${eventData.resource}`;
        }
        if (eventData.action) {
            baseDescription += ` (action: ${eventData.action})`;
        }

        return baseDescription;
    }

    /**
     * Generate unique event ID
     */
    generateEventId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `evt_${timestamp}_${random}`;
    }

    /**
     * Generate correlation ID for request tracking
     */
    generateCorrelationId() {
        return 'corr_' + Math.random().toString(36).substring(2, 12);
    }

    /**
     * Get audit log analytics
     */
    async getAuditAnalytics(options = {}) {
        const {
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            endDate = new Date(),
            eventCategory = null,
            riskLevel = null,
            userEmail = null
        } = options;

        try {
            // Build dynamic query
            let whereConditions = ['created_at BETWEEN $1 AND $2'];
            let params = [startDate, endDate];
            let paramIndex = 2;

            if (eventCategory) {
                whereConditions.push(`event_category = $${++paramIndex}`);
                params.push(eventCategory);
            }

            if (riskLevel) {
                whereConditions.push(`risk_level = $${++paramIndex}`);
                params.push(riskLevel);
            }

            if (userEmail) {
                whereConditions.push(`user_email = $${++paramIndex}`);
                params.push(userEmail);
            }

            const whereClause = whereConditions.join(' AND ');

            // Get comprehensive analytics
            const analyticsSQL = `
                SELECT 
                    COUNT(*) as total_events,
                    COUNT(DISTINCT user_email) as unique_users,
                    COUNT(CASE WHEN success = false THEN 1 END) as failed_events,
                    COUNT(CASE WHEN risk_level = 'high' OR risk_level = 'critical' THEN 1 END) as high_risk_events,
                    event_category,
                    risk_level,
                    DATE_TRUNC('day', created_at) as event_date,
                    COUNT(*) as daily_count
                FROM audit_logs 
                WHERE ${whereClause}
                GROUP BY event_category, risk_level, event_date
                ORDER BY event_date DESC, daily_count DESC
            `;

            const result = await this.dbClient.query(analyticsSQL, params);

            return {
                summary: {
                    totalEvents: result.rows.reduce((sum, row) => sum + parseInt(row.daily_count), 0),
                    uniqueUsers: new Set(result.rows.map(row => row.user_email)).size,
                    failedEvents: result.rows.reduce((sum, row) => sum + parseInt(row.failed_events || 0), 0),
                    highRiskEvents: result.rows.reduce((sum, row) => sum + parseInt(row.high_risk_events || 0), 0)
                },
                dailyBreakdown: result.rows,
                period: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            };

        } catch (error) {
            console.error('❌ Failed to get audit analytics:', error);
            throw error;
        }
    }

    /**
     * Get recent security events
     */
    async getRecentSecurityEvents(limit = 50) {
        try {
            const query = `
                SELECT event_id, event_type, event_category, risk_level, user_email, 
                       ip_address, event_description, success, created_at, event_data
                FROM audit_logs 
                WHERE event_category IN ('security', 'authentication') 
                   OR risk_level IN ('high', 'critical')
                ORDER BY created_at DESC 
                LIMIT $1
            `;

            const result = await this.dbClient.query(query, [limit]);
            return result.rows;

        } catch (error) {
            console.error('❌ Failed to get recent security events:', error);
            throw error;
        }
    }

    /**
     * Search audit logs with advanced filters
     */
    async searchAuditLogs(filters = {}) {
        const {
            eventType,
            userEmail,
            ipAddress,
            startDate,
            endDate,
            riskLevel,
            success,
            limit = 100,
            offset = 0
        } = filters;

        try {
            let whereConditions = [];
            let params = [];
            let paramIndex = 0;

            if (eventType) {
                whereConditions.push(`event_type = $${++paramIndex}`);
                params.push(eventType);
            }

            if (userEmail) {
                whereConditions.push(`user_email ILIKE $${++paramIndex}`);
                params.push(`%${userEmail}%`);
            }

            if (ipAddress) {
                whereConditions.push(`ip_address = $${++paramIndex}`);
                params.push(ipAddress);
            }

            if (startDate) {
                whereConditions.push(`created_at >= $${++paramIndex}`);
                params.push(startDate);
            }

            if (endDate) {
                whereConditions.push(`created_at <= $${++paramIndex}`);
                params.push(endDate);
            }

            if (riskLevel) {
                whereConditions.push(`risk_level = $${++paramIndex}`);
                params.push(riskLevel);
            }

            if (typeof success === 'boolean') {
                whereConditions.push(`success = $${++paramIndex}`);
                params.push(success);
            }

            const whereClause = whereConditions.length > 0 ? 
                'WHERE ' + whereConditions.join(' AND ') : '';

            const query = `
                SELECT * FROM audit_logs 
                ${whereClause}
                ORDER BY created_at DESC 
                LIMIT $${++paramIndex} OFFSET $${++paramIndex}
            `;

            params.push(limit, offset);
            const result = await this.dbClient.query(query, params);

            return {
                logs: result.rows,
                totalCount: result.rowCount,
                filters: filters
            };

        } catch (error) {
            console.error('❌ Failed to search audit logs:', error);
            throw error;
        }
    }

    /**
     * Clean up old audit logs
     */
    async cleanupOldLogs(daysToKeep = 365) {
        try {
            const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
            
            const deleteSQL = `
                DELETE FROM audit_logs 
                WHERE created_at < $1 
                AND risk_level NOT IN ('high', 'critical')
            `;

            const result = await this.dbClient.query(deleteSQL, [cutoffDate]);
            
            console.log(`🧹 Cleaned up ${result.rowCount} old audit log entries`);
            return result.rowCount;

        } catch (error) {
            console.error('❌ Failed to cleanup old audit logs:', error);
            throw error;
        }
    }

    /**
     * Health check for audit logging service
     */
    async healthCheck() {
        try {
            // Test database connection and basic functionality
            const testQuery = 'SELECT COUNT(*) as log_count FROM audit_logs WHERE created_at > NOW() - INTERVAL \'24 hours\'';
            const result = await this.dbClient.query(testQuery);
            
            const recentLogsCount = parseInt(result.rows[0].log_count);

            return {
                status: 'healthy',
                initialized: this.initialized,
                recentLogsCount,
                supportedEventTypes: Object.keys(this.eventTypes).length,
                riskLevels: Object.values(this.riskLevels)
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                initialized: this.initialized
            };
        }
    }
}

module.exports = { AuditLoggingService };