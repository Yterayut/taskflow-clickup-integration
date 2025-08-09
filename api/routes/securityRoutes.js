/**
 * Security Routes
 * API endpoints for account security management and lockout control
 */
const express = require('express');
const { requireJWT, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/v2/security/account/:email
 * Get account security information (admin only)
 */
router.get('/account/:email', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const { email } = req.params;
        const accountSecurityService = req.app.get('accountSecurityService');
        
        if (!accountSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Account security service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }
        
        const securityInfo = await accountSecurityService.getAccountSecurityInfo(email);
        
        if (!securityInfo) {
            return res.status(404).json({
                success: false,
                error: 'No security records found for this account',
                code: 'ACCOUNT_NOT_FOUND'
            });
        }
        
        res.json({
            success: true,
            data: securityInfo
        });
        
    } catch (error) {
        console.error('❌ Error getting account security info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve account security information',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * POST /api/v2/security/unlock/:email
 * Manually unlock an account (admin only)
 */
router.post('/unlock/:email', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const { email } = req.params;
        const adminEmail = req.user?.email;
        const accountSecurityService = req.app.get('accountSecurityService');
        
        if (!accountSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Account security service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }
        
        const unlocked = await accountSecurityService.unlockAccount(email, adminEmail);
        
        if (unlocked) {
            console.log(`🔓 Account ${email} unlocked by admin ${adminEmail}`);
            res.json({
                success: true,
                message: `Account ${email} has been unlocked`,
                unlockedBy: adminEmail,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Account not found or was not locked',
                code: 'ACCOUNT_NOT_FOUND'
            });
        }
        
    } catch (error) {
        console.error('❌ Error unlocking account:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unlock account',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/security/statistics
 * Get system-wide security statistics (admin only)
 */
router.get('/statistics', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const accountSecurityService = req.app.get('accountSecurityService');
        
        if (!accountSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Account security service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }
        
        const stats = await accountSecurityService.getSecurityStatistics();
        
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting security statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve security statistics',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/security/check/:email
 * Check if account is locked (public endpoint with rate limiting)
 */
router.get('/check/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const accountSecurityService = req.app.get('accountSecurityService');
        
        if (!accountSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Account security service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }
        
        const lockStatus = await accountSecurityService.isAccountLocked(email);
        
        // Only return essential info for security
        res.json({
            success: true,
            data: {
                isLocked: lockStatus.isLocked,
                needsCaptcha: lockStatus.needsCaptcha,
                remainingAttempts: lockStatus.remainingAttempts,
                minutesRemaining: lockStatus.lockoutInfo?.minutesRemaining || null
            }
        });
        
    } catch (error) {
        console.error('❌ Error checking account lock status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check account status',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * POST /api/v2/security/cleanup
 * Clean up old security records (admin only)
 */
router.post('/cleanup', requireJWT, requirePermission('admin'), async (req, res) => {
    try {
        const { daysToKeep = 90 } = req.body;
        const accountSecurityService = req.app.get('accountSecurityService');
        
        if (!accountSecurityService) {
            return res.status(503).json({
                success: false,
                error: 'Account security service not available',
                code: 'SERVICE_UNAVAILABLE'
            });
        }
        
        const cleanedCount = await accountSecurityService.cleanupOldRecords(daysToKeep);
        
        res.json({
            success: true,
            message: `Cleaned up ${cleanedCount} old security records`,
            cleanedRecords: cleanedCount,
            daysToKeep,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error cleaning up security records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup security records',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * GET /api/v2/security/health
 * Security service health check
 */
router.get('/health', async (req, res) => {
    try {
        const accountSecurityService = req.app.get('accountSecurityService');
        
        // Basic health check without requiring full service functionality
        const basicHealth = {
            service: 'Security Service',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            features: [
                'Account lockout protection',
                'Brute force prevention',
                'Security monitoring',
                'Admin controls'
            ]
        };
        
        if (!accountSecurityService) {
            basicHealth.status = 'degraded';
            basicHealth.warning = 'Account security service not available';
            return res.json({
                success: true,
                status: 'degraded',
                data: basicHealth
            });
        }
        
        try {
            const health = await accountSecurityService.healthCheck();
            basicHealth.serviceHealth = health;
            basicHealth.status = 'healthy';
        } catch (serviceError) {
            basicHealth.status = 'degraded';
            basicHealth.serviceError = serviceError.message;
        }
        
        res.json({
            success: true,
            status: basicHealth.status,
            data: basicHealth
        });
        
    } catch (error) {
        console.error('❌ Security service health check failed:', error);
        res.status(200).json({
            success: true,
            status: 'degraded',
            data: {
                service: 'Security Service',
                status: 'degraded',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        });
    }
});

module.exports = router;