/**
 * Audit Logging API Routes
 * Phase 1 Week 2 Implementation
 * 
 * Comprehensive audit trail and security analytics endpoints
 */

const express = require('express');
const { requireJWT, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/v2/audit/analytics
 * Get comprehensive audit analytics (admin only)
 */
router.get('/analytics', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const {
            startDate,
            endDate,
            eventCategory,
            riskLevel,
            userEmail
        } = req.query;

        const options = {};
        if (startDate) options.startDate = new Date(startDate);
        if (endDate) options.endDate = new Date(endDate);
        if (eventCategory) options.eventCategory = eventCategory;
        if (riskLevel) options.riskLevel = riskLevel;
        if (userEmail) options.userEmail = userEmail;

        const analytics = await auditService.getAuditAnalytics(options);

        // Log admin access to audit analytics
        await auditService.logEvent({
            eventType: auditService.eventTypes.ADMIN_ACCESS,
            description: 'Administrator accessed audit analytics',
            resourceAccessed: 'audit_analytics',
            riskLevel: auditService.riskLevels.MEDIUM,
            req
        });

        res.json({
            success: true,
            data: analytics,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting audit analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit analytics',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/audit/security-events
 * Get recent security events (admin only)
 */
router.get('/security-events', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const securityEvents = await auditService.getRecentSecurityEvents(limit);

        // Log admin access to security events
        await auditService.logEvent({
            eventType: auditService.eventTypes.ADMIN_ACCESS,
            description: 'Administrator accessed recent security events',
            resourceAccessed: 'security_events',
            riskLevel: auditService.riskLevels.MEDIUM,
            eventData: { limit },
            req
        });

        res.json({
            success: true,
            data: {
                events: securityEvents,
                count: securityEvents.length,
                limit
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting security events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security events',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * POST /api/v2/audit/search
 * Search audit logs with advanced filters (admin only)
 */
router.post('/search', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

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
        } = req.body;

        const filters = {
            eventType,
            userEmail,
            ipAddress,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            riskLevel,
            success,
            limit: Math.min(limit, 1000), // Cap at 1000 for performance
            offset
        };

        const searchResults = await auditService.searchAuditLogs(filters);

        // Log admin search activity
        await auditService.logEvent({
            eventType: auditService.eventTypes.ADMIN_ACCESS,
            description: 'Administrator performed audit log search',
            resourceAccessed: 'audit_logs',
            riskLevel: auditService.riskLevels.MEDIUM,
            eventData: { filters },
            req
        });

        res.json({
            success: true,
            data: searchResults,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error searching audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search audit logs',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/audit/user/:email
 * Get audit logs for specific user (admin only)
 */
router.get('/user/:email', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const { email } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const userLogs = await auditService.searchAuditLogs({
            userEmail: email,
            limit,
            offset
        });

        // Log admin access to user-specific logs
        await auditService.logEvent({
            eventType: auditService.eventTypes.ADMIN_ACCESS,
            description: `Administrator accessed audit logs for user: ${email}`,
            resourceAccessed: 'user_audit_logs',
            riskLevel: auditService.riskLevels.HIGH, // High risk - accessing user data
            eventData: { targetUser: email, limit, offset },
            req
        });

        res.json({
            success: true,
            data: {
                userEmail: email,
                logs: userLogs.logs,
                totalCount: userLogs.totalCount,
                limit,
                offset
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting user audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user audit logs',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/audit/dashboard
 * Get audit dashboard summary (admin only)
 */
router.get('/dashboard', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        // Get multiple analytics views
        const [
            last24Hours,
            lastWeek,
            securityEvents,
            healthStatus
        ] = await Promise.all([
            auditService.getAuditAnalytics({
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
                endDate: new Date()
            }),
            auditService.getAuditAnalytics({
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                endDate: new Date()
            }),
            auditService.getRecentSecurityEvents(20),
            auditService.healthCheck()
        ]);

        const dashboard = {
            summary: {
                last24Hours: last24Hours.summary,
                lastWeek: lastWeek.summary,
                systemHealth: healthStatus
            },
            recentSecurityEvents: securityEvents.slice(0, 10), // Top 10 most recent
            trends: {
                dailyActivity: lastWeek.dailyBreakdown
            }
        };

        // Log admin dashboard access
        await auditService.logEvent({
            eventType: auditService.eventTypes.ADMIN_ACCESS,
            description: 'Administrator accessed audit dashboard',
            resourceAccessed: 'audit_dashboard',
            riskLevel: auditService.riskLevels.MEDIUM,
            req
        });

        res.json({
            success: true,
            data: dashboard,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting audit dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit dashboard',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * POST /api/v2/audit/cleanup
 * Clean up old audit logs (admin only)
 */
router.post('/cleanup', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const { daysToKeep = 365 } = req.body;
        
        // Validate input
        if (daysToKeep < 30) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete logs newer than 30 days',
                code: 'INVALID_RETENTION_PERIOD'
            });
        }

        const cleanedCount = await auditService.cleanupOldLogs(daysToKeep);

        // Log cleanup activity
        await auditService.logEvent({
            eventType: auditService.eventTypes.ADMIN_ACCESS,
            description: `Administrator cleaned up ${cleanedCount} old audit logs`,
            resourceAccessed: 'audit_logs',
            riskLevel: auditService.riskLevels.HIGH, // High risk - data deletion
            eventData: { 
                daysToKeep,
                cleanedCount,
                action: 'cleanup_audit_logs'
            },
            req
        });

        res.json({
            success: true,
            message: `Successfully cleaned up ${cleanedCount} old audit log entries`,
            data: {
                cleanedCount,
                daysToKeep,
                cutoffDate: new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error cleaning up audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup audit logs',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/audit/health
 * Audit service health check
 */
router.get('/health', async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const health = await auditService.healthCheck();

        res.json({
            success: true,
            status: health.status,
            data: health,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Audit service health check failed:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            code: 'HEALTH_CHECK_FAILED'
        });
    }
});

/**
 * GET /api/v2/audit/export
 * Export audit logs (admin only)
 */
router.get('/export', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const auditService = req.app.get('auditLoggingService');
        
        if (!auditService) {
            return res.status(503).json({
                success: false,
                error: 'Audit logging service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }

        const {
            startDate,
            endDate,
            format = 'json'
        } = req.query;

        const exportFilters = {
            startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: endDate ? new Date(endDate) : new Date(),
            limit: 10000 // Large export limit
        };

        const exportData = await auditService.searchAuditLogs(exportFilters);

        // Log high-risk export activity
        await auditService.logEvent({
            eventType: auditService.eventTypes.DATA_EXPORT,
            description: 'Administrator exported audit logs',
            resourceAccessed: 'audit_logs',
            riskLevel: auditService.riskLevels.CRITICAL, // Critical - data export
            eventData: { 
                exportFilters,
                recordCount: exportData.logs.length,
                format
            },
            req
        });

        if (format === 'csv') {
            // Convert to CSV format
            const csvHeader = 'Event ID,Event Type,User Email,IP Address,Created At,Description,Success\n';
            const csvRows = exportData.logs.map(log => 
                `"${log.event_id}","${log.event_type}","${log.user_email || ''}","${log.ip_address || ''}","${log.created_at}","${log.event_description}","${log.success}"`
            ).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
            res.send(csvHeader + csvRows);
        } else {
            // JSON format
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.json"`);
            res.json({
                success: true,
                data: exportData,
                exportInfo: {
                    totalRecords: exportData.logs.length,
                    filters: exportFilters,
                    exportedAt: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error('❌ Error exporting audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export audit logs',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = router;