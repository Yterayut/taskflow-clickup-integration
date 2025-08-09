/**
 * Email API Routes
 * TaskFlow Pro v2.2 - Email service management endpoints
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize email routes with dependencies
 */
function createEmailRoutes(emailService, auditLoggingService) {
    
    /**
     * GET /api/v2/email/status
     * Get email service status
     */
    router.get('/status', async (req, res) => {
        try {
            const status = emailService.getStatus();
            const testResult = await emailService.testConnection();

            res.json({
                success: true,
                status: {
                    ...status,
                    connectionTest: testResult,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error getting email status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get email status'
            });
        }
    });

    /**
     * POST /api/v2/email/test
     * Send test email (admin only)
     */
    router.post('/test', async (req, res) => {
        try {
            const { 
                to = process.env.ADMIN_EMAIL || 'admin@taskflow.pro',
                subject = 'TaskFlow Email Service Test',
                message = 'This is a test email from TaskFlow Pro email service.'
            } = req.body;

            // Log the test email request
            if (auditLoggingService) {
                await auditLoggingService.logEvent('email_test', {
                    to,
                    subject,
                    initiatedBy: req.user?.email || 'system',
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                }, 'low');
            }

            const result = await emailService.sendEmail({
                to,
                subject,
                text: message,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>📧 TaskFlow Email Service Test</h2>
                        <p>${message}</p>
                        <hr>
                        <p><small>Sent from TaskFlow Pro v2.2 | ${new Date().toLocaleString()}</small></p>
                    </div>
                `
            });

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Test email sent successfully',
                    result
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to send test email',
                    details: result.error
                });
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send test email'
            });
        }
    });

    /**
     * POST /api/v2/email/security-alert
     * Send security alert email (internal use)
     */
    router.post('/security-alert', async (req, res) => {
        try {
            const { alertData, recipients } = req.body;

            if (!alertData) {
                return res.status(400).json({
                    success: false,
                    error: 'Alert data is required'
                });
            }

            // Enhance alert data with request information
            const enhancedAlertData = {
                ...alertData,
                recipients: recipients || [process.env.SECURITY_ALERT_EMAIL],
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: alertData.timestamp || new Date().toISOString()
            };

            const result = await emailService.sendSecurityAlert(enhancedAlertData);

            // Log the security alert
            if (auditLoggingService) {
                await auditLoggingService.logEvent('security_alert_email', {
                    alertType: alertData.type,
                    severity: alertData.severity,
                    recipients: enhancedAlertData.recipients,
                    emailResult: result.success,
                    messageId: result.messageId
                }, alertData.severity || 'medium');
            }

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Security alert email sent successfully',
                    messageId: result.messageId
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to send security alert email',
                    details: result.error
                });
            }
        } catch (error) {
            console.error('Error sending security alert email:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send security alert email'
            });
        }
    });

    /**
     * POST /api/v2/email/password-reset
     * Send password reset email (internal use)
     */
    router.post('/password-reset', async (req, res) => {
        try {
            const { email, resetToken, resetUrl } = req.body;

            if (!email || !resetToken || !resetUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, reset token, and reset URL are required'
                });
            }

            const resetData = {
                email,
                resetToken,
                resetUrl,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
            };

            const result = await emailService.sendPasswordReset(resetData);

            // Log the password reset email
            if (auditLoggingService) {
                await auditLoggingService.logEvent('password_reset_email', {
                    email,
                    emailResult: result.success,
                    messageId: result.messageId,
                    ip: req.ip
                }, 'medium');
            }

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Password reset email sent successfully',
                    messageId: result.messageId
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to send password reset email',
                    details: result.error
                });
            }
        } catch (error) {
            console.error('Error sending password reset email:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send password reset email'
            });
        }
    });

    /**
     * POST /api/v2/email/account-lockout
     * Send account lockout notification (internal use)
     */
    router.post('/account-lockout', async (req, res) => {
        try {
            const { email, attempts, duration, timestamp } = req.body;

            if (!email || !attempts || !duration) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, attempts, and duration are required'
                });
            }

            const lockoutData = {
                email,
                attempts,
                duration,
                timestamp: timestamp || new Date().toISOString()
            };

            const result = await emailService.sendAccountLockout(lockoutData);

            // Log the account lockout email
            if (auditLoggingService) {
                await auditLoggingService.logEvent('account_lockout_email', {
                    email,
                    attempts,
                    duration,
                    emailResult: result.success,
                    messageId: result.messageId,
                    ip: req.ip
                }, 'high');
            }

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Account lockout notification sent successfully',
                    messageId: result.messageId
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to send account lockout notification',
                    details: result.error
                });
            }
        } catch (error) {
            console.error('Error sending account lockout notification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send account lockout notification'
            });
        }
    });

    /**
     * POST /api/v2/email/system-notification
     * Send system notification email (admin only)
     */
    router.post('/system-notification', async (req, res) => {
        try {
            const { title, message, recipients, priority = 'normal' } = req.body;

            if (!title || !message || !recipients) {
                return res.status(400).json({
                    success: false,
                    error: 'Title, message, and recipients are required'
                });
            }

            const notificationData = {
                title,
                message,
                recipients: Array.isArray(recipients) ? recipients : [recipients],
                priority,
                timestamp: new Date().toISOString()
            };

            const result = await emailService.sendSystemNotification(notificationData);

            // Log the system notification
            if (auditLoggingService) {
                await auditLoggingService.logEvent('system_notification_email', {
                    title,
                    recipients: notificationData.recipients,
                    priority,
                    emailResult: result.success,
                    messageId: result.messageId,
                    initiatedBy: req.user?.email || 'system'
                }, 'low');
            }

            if (result.success) {
                res.json({
                    success: true,
                    message: 'System notification sent successfully',
                    messageId: result.messageId
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to send system notification',
                    details: result.error
                });
            }
        } catch (error) {
            console.error('Error sending system notification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send system notification'
            });
        }
    });

    /**
     * GET /api/v2/email/health
     * Health check endpoint for email service
     */
    router.get('/health', async (req, res) => {
        try {
            const status = emailService.getStatus();
            const testResult = await emailService.testConnection();

            const isHealthy = status.enabled && testResult.success;

            res.status(isHealthy ? 200 : 503).json({
                success: isHealthy,
                status: isHealthy ? 'healthy' : 'unhealthy',
                service: 'TaskFlow Email Service',
                version: '2.2.0',
                enabled: status.enabled,
                connected: testResult.success,
                host: status.host,
                port: status.port,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
}

module.exports = createEmailRoutes;