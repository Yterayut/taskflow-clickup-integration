/**
 * System Health and Monitoring Routes
 * Admin endpoints for system health monitoring
 */
const express = require('express');
const { SystemService } = require('../../application/services/SystemService');

const router = express.Router();

// Import system monitoring
const { systemMonitoring } = require('../../middleware/systemMonitoring');

/**
 * GET /api/v2/system/status
 * Get current system operational status
 */
router.get('/status', async (req, res) => {
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
 * GET /api/v2/system/health
 * Comprehensive system health check
 */
router.get('/health', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const healthMetrics = await systemService.getHealthMetrics();
        
        // Determine overall health status
        const isHealthy = healthMetrics.system_status?.is_operational && 
                         healthMetrics.database_status === 'connected';
        
        const httpStatus = isHealthy ? 200 : 503;
        
        res.status(httpStatus).json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: healthMetrics.timestamp,
            version: '2.1.0',
            service: 'TaskFlow Pro Single Login Authentication',
            components: {
                database: {
                    status: healthMetrics.database_status,
                    healthy: healthMetrics.database_status === 'connected'
                },
                clickup_integration: {
                    status: healthMetrics.system_status?.status_level || 'unknown',
                    connected: healthMetrics.system_status?.clickup_connected || false,
                    healthy: healthMetrics.system_status?.is_operational || false,
                    expires_at: healthMetrics.system_status?.expires_at,
                    message: healthMetrics.system_status?.message
                },
                authentication: {
                    status: 'operational',
                    healthy: true,
                    active_sessions: healthMetrics.active_sessions || 0
                }
            },
            metrics: {
                uptime_seconds: Math.floor(process.uptime()),
                memory_usage: process.memoryUsage(),
                cpu_usage: process.cpuUsage(),
                active_sessions: healthMetrics.active_sessions,
                last_successful_login: healthMetrics.last_successful_login,
                failed_login_count_24h: healthMetrics.failed_login_count_24h
            }
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date(),
            error: error.message,
            service: 'TaskFlow Pro Single Login Authentication'
        });
    }
});

/**
 * GET /api/v2/system/metrics
 * Detailed system metrics (admin only)
 */
router.get('/metrics', async (req, res) => {
    try {
        // Basic auth check (should be enhanced with proper admin verification)
        const jwtService = req.app.get('jwtService');
        
        let token = req.cookies?.taskflow_token;
        if (!token) {
            token = jwtService.extractTokenFromHeader(req.headers.authorization);
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required for metrics',
                code: 'TOKEN_MISSING'
            });
        }
        
        const payload = jwtService.verifyToken(token);
        
        // Only master user can access detailed metrics
        if (payload.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required for detailed metrics',
                code: 'INSUFFICIENT_PRIVILEGES'
            });
        }
        
        const systemService = req.app.get('systemService');
        const userRepository = req.app.get('userRepository');
        const tokenRepository = req.app.get('tokenRepository');
        const statusRepository = req.app.get('statusRepository');
        
        // Gather comprehensive metrics
        const [
            systemStatus,
            userStats,
            tokenStats,
            statusStats
        ] = await Promise.all([
            systemService.getStatus(),
            userRepository.getStatistics(),
            tokenRepository.getStatistics(),
            statusRepository.getStatusStatistics()
        ]);
        
        res.json({
            success: true,
            timestamp: new Date(),
            system: {
                status: systemStatus.toApiResponse(),
                uptime_seconds: Math.floor(process.uptime()),
                memory_usage: process.memoryUsage(),
                cpu_usage: process.cpuUsage(),
                node_version: process.version,
                platform: process.platform,
                environment: process.env.NODE_ENV
            },
            users: {
                total_users: parseInt(userStats.total_users),
                master_users: parseInt(userStats.master_users),
                regular_users: parseInt(userStats.regular_users),
                active_users: parseInt(userStats.active_users),
                active_last_30_days: parseInt(userStats.active_last_30_days)
            },
            tokens: {
                total_tokens: parseInt(tokenStats.total_tokens),
                valid_tokens: parseInt(tokenStats.valid_tokens),
                expired_tokens: parseInt(tokenStats.expired_tokens),
                tokens_with_refresh: parseInt(tokenStats.tokens_with_refresh),
                avg_refresh_attempts: parseFloat(tokenStats.avg_refresh_attempts) || 0,
                latest_expiry: tokenStats.latest_expiry,
                earliest_expiry: tokenStats.earliest_expiry
            },
            system_status_history: {
                total_records: parseInt(statusStats.total_records),
                connected_count: parseInt(statusStats.connected_count),
                disconnected_count: parseInt(statusStats.disconnected_count),
                avg_active_sessions: parseFloat(statusStats.avg_active_sessions) || 0,
                latest_health_check: statusStats.latest_health_check,
                earliest_record: statusStats.earliest_record
            }
        });
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system metrics',
            code: 'METRICS_ERROR'
        });
    }
});

/**
 * GET /api/v2/system/uptime
 * Get system uptime statistics
 */
router.get('/uptime', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const hoursBack = Math.min(parseInt(hours), 168); // Max 7 days
        
        const statusRepository = req.app.get('statusRepository');
        const uptimeStats = await statusRepository.getUptimePercentage(hoursBack);
        
        res.json({
            success: true,
            period_hours: hoursBack,
            uptime_percentage: parseFloat(uptimeStats.uptime_percentage) || 0,
            total_checks: parseInt(uptimeStats.total_checks),
            successful_checks: parseInt(uptimeStats.successful_checks),
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Uptime stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve uptime statistics',
            code: 'UPTIME_ERROR'
        });
    }
});

/**
 * POST /api/v2/system/maintenance/cleanup
 * Cleanup old records (admin only)
 */
router.post('/maintenance/cleanup', async (req, res) => {
    try {
        // Verify admin access
        const jwtService = req.app.get('jwtService');
        
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
        
        if (payload.role !== 'master') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required for maintenance operations',
                code: 'INSUFFICIENT_PRIVILEGES'
            });
        }
        
        const { 
            cleanup_tokens = true, 
            cleanup_status = true,
            days_to_keep = 30 
        } = req.body;
        
        const results = {};
        
        // Cleanup expired tokens
        if (cleanup_tokens) {
            const tokenRepository = req.app.get('tokenRepository');
            results.expired_tokens_cleaned = await tokenRepository.cleanupExpiredTokens(days_to_keep);
        }
        
        // Cleanup old status records
        if (cleanup_status) {
            const statusRepository = req.app.get('statusRepository');
            results.old_status_records_cleaned = await statusRepository.cleanupOldStatus(days_to_keep);
        }
        
        console.log('Maintenance cleanup completed by:', payload.email, results);
        
        res.json({
            success: true,
            message: 'Cleanup completed successfully',
            results,
            performed_by: payload.email,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({
            success: false,
            error: 'Cleanup operation failed',
            code: 'CLEANUP_ERROR'
        });
    }
});

/**
 * GET /api/v2/system/version
 * Get system version and build information
 */
router.get('/version', (req, res) => {
    res.json({
        success: true,
        version: '2.1.0',
        name: 'TaskFlow Pro Single Login Authentication',
        description: 'Domain-driven authentication system with ClickUp integration',
        features: [
            'Single form login with auto flow detection',
            'Master user ClickUp OAuth integration',
            'Regular user email/password authentication',
            'JWT with HttpOnly cookies',
            'Automatic token refresh',
            'System health monitoring',
            'Role-based access control'
        ],
        build_info: {
            node_version: process.version,
            platform: process.platform,
            architecture: process.arch,
            environment: process.env.NODE_ENV,
            uptime_seconds: Math.floor(process.uptime())
        },
        api_endpoints: {
            authentication: '/api/v2/auth/*',
            oauth: '/auth/clickup/*',
            system: '/api/v2/system/*'
        }
    });
});

/**
 * GET /api/v2/system/metrics
 * Get real-time system performance metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = systemMonitoring.getMetrics();
        res.json({
            success: true,
            metrics: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('System metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system metrics',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/v2/system/health-detailed
 * Comprehensive health check with performance metrics
 */
router.get('/health-detailed', async (req, res) => {
    try {
        const healthStatus = systemMonitoring.getHealthStatus();
        const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;
        
        res.status(httpStatus).json(healthStatus);
    } catch (error) {
        console.error('Detailed health check error:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;