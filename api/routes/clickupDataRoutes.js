/**
 * ClickUp Data Routes
 * Provides ClickUp data for dashboard consumption
 */
const express = require('express');
const router = express.Router();

/**
 * GET /api/v2/clickup/data
 * Get ClickUp data for dashboard
 */
router.get('/data', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const clickupIntegration = req.app.get('clickupIntegration');
        
        // Check system status first
        const status = await systemService.getStatus();
        
        if (!status.clickupConnected) {
            return res.status(503).json({
                success: false,
                error: 'ClickUp not connected',
                code: 'CLICKUP_NOT_CONNECTED',
                message: 'Master user needs to authenticate with ClickUp first'
            });
        }
        
        // Get ClickUp token
        const tokenRepository = req.app.get('tokenRepository');
        const clickupToken = await tokenRepository.findMasterToken();
        
        if (!clickupToken || !clickupToken.accessToken) {
            return res.status(503).json({
                success: false,
                error: 'No valid ClickUp token',
                code: 'TOKEN_MISSING',
                message: 'ClickUp token not found or expired'
            });
        }
        
        // Fetch comprehensive ClickUp data
        try {
            console.log('🔄 Fetching comprehensive ClickUp data...');
            const comprehensiveData = await clickupIntegration.getComprehensiveData(clickupToken.accessToken);
            
            console.log('✅ Real ClickUp data fetched:', {
                teams: comprehensiveData.teams?.length || 0,
                tasks: comprehensiveData.tasks?.length || 0,
                members: comprehensiveData.team_members?.length || 0,
                workload: comprehensiveData.workload
            });
            
            res.json({
                success: true,
                data: comprehensiveData,
                timestamp: new Date().toISOString(),
                source: 'clickup_api_real'
            });
            
        } catch (clickupError) {
            console.error('ClickUp API error:', clickupError);
            
            res.status(503).json({
                success: false,
                error: 'ClickUp API error',
                code: 'CLICKUP_API_ERROR',
                message: clickupError.message
            });
        }
        
    } catch (error) {
        console.error('ClickUp data endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            message: error.message
        });
    }
});

/**
 * GET /api/v2/clickup/status
 * Get ClickUp connection status
 */
router.get('/status', async (req, res) => {
    try {
        const systemService = req.app.get('systemService');
        const status = await systemService.getStatus();
        
        res.json({
            success: true,
            connected: status.clickupConnected,
            operational: status.isOperational(),
            message: status.getStatusMessage(),
            expires_at: status.tokenExpiresAt,
            time_until_expiry_minutes: status.getTimeUntilExpiry()
        });
    } catch (error) {
        console.error('ClickUp status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ClickUp status',
            code: 'STATUS_ERROR'
        });
    }
});

module.exports = router;