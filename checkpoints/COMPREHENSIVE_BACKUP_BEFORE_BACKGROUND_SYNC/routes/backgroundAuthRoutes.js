/**
 * Background Authentication API Routes
 * Provides management endpoints for automatic authentication system
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/v2/background-auth/status
 * Get current background authentication system status
 */
router.get('/status', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        const status = await backgroundAuthIntegration.getSystemStatus();
        
        res.json({
            success: true,
            status: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Failed to get background auth status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve background authentication status',
            message: error.message,
            code: 'STATUS_ERROR'
        });
    }
});

/**
 * POST /api/v2/background-auth/force-refresh
 * Force immediate token refresh
 */
router.post('/force-refresh', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        console.log('🔄 Force token refresh requested via API');
        
        const result = await backgroundAuthIntegration.forceTokenRefresh();
        
        res.json({
            success: true,
            result: result,
            message: 'Token refresh completed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Force refresh failed:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            message: error.message,
            code: 'REFRESH_ERROR'
        });
    }
});

/**
 * GET /api/v2/background-auth/config
 * Get current background service configuration
 */
router.get('/config', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        const status = await backgroundAuthIntegration.getAuthStatus();
        
        res.json({
            success: true,
            config: status.background_service?.config || {},
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Failed to get config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve configuration',
            message: error.message
        });
    }
});

/**
 * PUT /api/v2/background-auth/config
 * Update background service configuration
 */
router.put('/config', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        const newConfig = req.body;
        
        // Validate configuration
        const allowedKeys = [
            'checkIntervalMinutes',
            'refreshThresholdHours',
            'emergencyRefreshMinutes',
            'maxRetryAttempts',
            'retryDelayMinutes'
        ];
        
        const sanitizedConfig = {};
        for (const key of allowedKeys) {
            if (newConfig[key] !== undefined) {
                sanitizedConfig[key] = newConfig[key];
            }
        }
        
        if (Object.keys(sanitizedConfig).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid configuration parameters provided',
                allowedKeys: allowedKeys
            });
        }
        
        console.log('⚙️ Updating background auth config:', sanitizedConfig);
        
        const result = backgroundAuthIntegration.updateBackgroundConfig(sanitizedConfig);
        
        res.json({
            success: true,
            result: result,
            message: 'Configuration updated successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Failed to update config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/background-auth/audit-logs
 * Get recent audit logs
 */
router.get('/audit-logs', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        const lines = parseInt(req.query.lines) || 50;
        const logs = await backgroundAuthIntegration.secureStorage.getAuditLogs(lines);
        
        res.json({
            success: true,
            logs: logs,
            count: logs.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Failed to get audit logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve audit logs',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/background-auth/health
 * Health check for background authentication system
 */
router.get('/health', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                status: 'unavailable',
                message: 'Background authentication service not initialized'
            });
        }
        
        const isOperational = await backgroundAuthIntegration.isSystemOperational();
        const authStatus = await backgroundAuthIntegration.getAuthStatus();
        
        const status = isOperational ? 'healthy' : 'degraded';
        const httpStatus = isOperational ? 200 : 503;
        
        res.status(httpStatus).json({
            success: true,
            status: status,
            operational: isOperational,
            details: {
                background_service_running: authStatus.background_service?.isRunning || false,
                background_service_healthy: authStatus.background_service?.isHealthy || false,
                token_available: authStatus.stored_token?.available || false,
                storage_initialized: authStatus.storage?.isInitialized || false
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Background auth health check failed:', error);
        res.status(500).json({
            success: false,
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/v2/background-auth/emergency-stop
 * Emergency stop background authentication service
 */
router.post('/emergency-stop', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        console.warn('🚨 Emergency stop requested for background authentication');
        
        const result = await backgroundAuthIntegration.emergencyStop();
        
        res.json({
            success: true,
            result: result,
            message: 'Background authentication stopped',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Emergency stop failed:', error);
        res.status(500).json({
            success: false,
            error: 'Emergency stop failed',
            message: error.message
        });
    }
});

/**
 * POST /api/v2/background-auth/emergency-reset
 * Emergency reset - clear all stored data
 */
router.post('/emergency-reset', async (req, res) => {
    try {
        const backgroundAuthIntegration = req.app.get('backgroundAuthIntegration');
        
        if (!backgroundAuthIntegration) {
            return res.status(503).json({
                success: false,
                error: 'Background authentication not available',
                code: 'SERVICE_NOT_AVAILABLE'
            });
        }
        
        const confirmReset = req.body.confirm;
        
        if (confirmReset !== 'RESET_ALL_DATA') {
            return res.status(400).json({
                success: false,
                error: 'Emergency reset requires confirmation',
                required_confirmation: 'RESET_ALL_DATA'
            });
        }
        
        console.warn('🚨 Emergency reset requested - clearing all data');
        
        const result = await backgroundAuthIntegration.emergencyReset();
        
        res.json({
            success: true,
            result: result,
            message: 'Emergency reset completed - all data cleared',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Emergency reset failed:', error);
        res.status(500).json({
            success: false,
            error: 'Emergency reset failed',
            message: error.message
        });
    }
});

module.exports = router;