/**
 * Email Service - Infrastructure Adapter
 * TaskFlow Pro v2.2 - Enterprise email functionality
 */

const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled !== false,
            host: config.host || process.env.SMTP_HOST || 'smtp.gmail.com',
            port: config.port || process.env.SMTP_PORT || 587,
            secure: config.secure || (config.port === 465),
            auth: {
                user: config.user || process.env.SMTP_USER,
                pass: config.pass || process.env.SMTP_PASSWORD
            },
            from: config.from || process.env.SMTP_FROM || 'TaskFlow Pro <noreply@taskflow.pro>',
            templates: config.templates || {},
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000
        };

        this.transporter = null;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        if (!this.config.enabled) {
            console.log('📧 Email service disabled');
            return;
        }

        try {
            this.transporter = nodemailer.createTransporter({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: this.config.auth,
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Verify connection
            await this.transporter.verify();
            console.log('✅ Email service initialized successfully');
        } catch (error) {
            console.error('❌ Email service initialization failed:', error.message);
            this.config.enabled = false;
        }
    }

    /**
     * Send security alert email
     */
    async sendSecurityAlert(alertData) {
        const template = this.getSecurityAlertTemplate(alertData);
        
        return await this.sendEmail({
            to: alertData.recipients || [process.env.SECURITY_ALERT_EMAIL],
            subject: `🚨 TaskFlow Security Alert: ${alertData.type}`,
            html: template.html,
            text: template.text,
            priority: 'high'
        });
    }

    /**
     * Send system notification email
     */
    async sendSystemNotification(notificationData) {
        const template = this.getSystemNotificationTemplate(notificationData);
        
        return await this.sendEmail({
            to: notificationData.recipients,
            subject: `🔔 TaskFlow Notification: ${notificationData.title}`,
            html: template.html,
            text: template.text
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(resetData) {
        const template = this.getPasswordResetTemplate(resetData);
        
        return await this.sendEmail({
            to: resetData.email,
            subject: '🔐 TaskFlow Password Reset',
            html: template.html,
            text: template.text
        });
    }

    /**
     * Send account lockout notification
     */
    async sendAccountLockout(lockoutData) {
        const template = this.getAccountLockoutTemplate(lockoutData);
        
        return await this.sendEmail({
            to: lockoutData.email,
            subject: '🔒 TaskFlow Account Security Alert',
            html: template.html,
            text: template.text,
            priority: 'high'
        });
    }

    /**
     * Core email sending method with retry logic
     */
    async sendEmail(emailOptions) {
        if (!this.config.enabled || !this.transporter) {
            console.log('📧 Email service disabled, email not sent:', emailOptions.subject);
            return { success: false, reason: 'Email service disabled' };
        }

        const mailOptions = {
            from: this.config.from,
            to: Array.isArray(emailOptions.to) ? emailOptions.to.join(', ') : emailOptions.to,
            subject: emailOptions.subject,
            text: emailOptions.text,
            html: emailOptions.html,
            priority: emailOptions.priority || 'normal'
        };

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const info = await this.transporter.sendMail(mailOptions);
                console.log(`✅ Email sent successfully (attempt ${attempt}):`, info.messageId);
                
                return {
                    success: true,
                    messageId: info.messageId,
                    attempt,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error(`❌ Email sending failed (attempt ${attempt}):`, error.message);
                
                if (attempt === this.config.retryAttempts) {
                    return {
                        success: false,
                        error: error.message,
                        attempts: attempt,
                        timestamp: new Date().toISOString()
                    };
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
            }
        }
    }

    /**
     * Generate security alert email template
     */
    getSecurityAlertTemplate(alertData) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
                .content { background: #f9fafb; padding: 20px; }
                .alert-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 15px 0; border-radius: 5px; }
                .details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .severity-critical { border-left: 5px solid #dc2626; }
                .severity-high { border-left: 5px solid #ea580c; }
                .severity-medium { border-left: 5px solid #d97706; }
                .severity-low { border-left: 5px solid #65a30d; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚨 TaskFlow Security Alert</h1>
                </div>
                <div class="content">
                    <div class="alert-box severity-${alertData.severity}">
                        <h2>${alertData.type}</h2>
                        <p><strong>Severity:</strong> ${alertData.severity.toUpperCase()}</p>
                        <p><strong>Time:</strong> ${new Date(alertData.timestamp).toLocaleString()}</p>
                        <p><strong>Description:</strong> ${alertData.message}</p>
                    </div>
                    
                    <div class="details">
                        <h3>Alert Details</h3>
                        <p><strong>Alert ID:</strong> ${alertData.id}</p>
                        <p><strong>Source:</strong> ${alertData.source || 'TaskFlow System'}</p>
                        <p><strong>IP Address:</strong> ${alertData.ip || 'Unknown'}</p>
                        <p><strong>User Agent:</strong> ${alertData.userAgent || 'Unknown'}</p>
                        ${alertData.user ? `<p><strong>User:</strong> ${alertData.user}</p>` : ''}
                        ${alertData.details ? `<p><strong>Additional Details:</strong> ${alertData.details}</p>` : ''}
                    </div>

                    <div class="details">
                        <h3>Recommended Actions</h3>
                        <ul>
                            <li>Review the security logs for related events</li>
                            <li>Check for any suspicious activities</li>
                            <li>Verify the affected user account if applicable</li>
                            <li>Consider implementing additional security measures</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated security alert from TaskFlow Pro</p>
                    <p>System: ${process.env.NODE_ENV || 'production'} | Version: 2.2.0</p>
                </div>
            </div>
        </body>
        </html>`;

        const text = `
TaskFlow Security Alert: ${alertData.type}

Severity: ${alertData.severity.toUpperCase()}
Time: ${new Date(alertData.timestamp).toLocaleString()}
Description: ${alertData.message}

Alert Details:
- Alert ID: ${alertData.id}
- Source: ${alertData.source || 'TaskFlow System'}
- IP Address: ${alertData.ip || 'Unknown'}
- User Agent: ${alertData.userAgent || 'Unknown'}
${alertData.user ? `- User: ${alertData.user}` : ''}
${alertData.details ? `- Additional Details: ${alertData.details}` : ''}

This is an automated security alert from TaskFlow Pro.
        `;

        return { html, text };
    }

    /**
     * Generate system notification email template
     */
    getSystemNotificationTemplate(notificationData) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
                .content { background: #f9fafb; padding: 20px; }
                .notification-box { background: #eff6ff; border: 1px solid #93c5fd; padding: 15px; margin: 15px 0; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔔 TaskFlow Notification</h1>
                </div>
                <div class="content">
                    <div class="notification-box">
                        <h2>${notificationData.title}</h2>
                        <p>${notificationData.message}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                </div>
                <div class="footer">
                    <p>TaskFlow Pro System Notification</p>
                </div>
            </div>
        </body>
        </html>`;

        const text = `
TaskFlow Notification: ${notificationData.title}

${notificationData.message}

Time: ${new Date().toLocaleString()}
        `;

        return { html, text };
    }

    /**
     * Generate password reset email template
     */
    getPasswordResetTemplate(resetData) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #059669; color: white; padding: 20px; text-align: center; }
                .content { background: #f9fafb; padding: 20px; }
                .reset-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; margin: 15px 0; border-radius: 5px; text-align: center; }
                .button { background: #059669; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset</h1>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>You requested a password reset for your TaskFlow account.</p>
                    
                    <div class="reset-box">
                        <h3>Reset Your Password</h3>
                        <p>Click the button below to reset your password:</p>
                        <a href="${resetData.resetUrl}" class="button">Reset Password</a>
                        <p><small>This link will expire in 15 minutes.</small></p>
                    </div>

                    <p>If you didn't request this reset, please ignore this email.</p>
                    <p>For security reasons, this link will only work once and expires in 15 minutes.</p>
                </div>
                <div class="footer">
                    <p>TaskFlow Pro Security Team</p>
                </div>
            </div>
        </body>
        </html>`;

        const text = `
TaskFlow Password Reset

Hello,

You requested a password reset for your TaskFlow account.

Reset URL: ${resetData.resetUrl}

This link will expire in 15 minutes.

If you didn't request this reset, please ignore this email.

TaskFlow Pro Security Team
        `;

        return { html, text };
    }

    /**
     * Generate account lockout email template
     */
    getAccountLockoutTemplate(lockoutData) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
                .content { background: #f9fafb; padding: 20px; }
                .warning-box { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; margin: 15px 0; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔒 Account Security Alert</h1>
                </div>
                <div class="content">
                    <div class="warning-box">
                        <h2>Account Temporarily Locked</h2>
                        <p>Your TaskFlow account has been temporarily locked due to multiple failed login attempts.</p>
                        <p><strong>Lockout Time:</strong> ${new Date(lockoutData.timestamp).toLocaleString()}</p>
                        <p><strong>Failed Attempts:</strong> ${lockoutData.attempts}</p>
                        <p><strong>Lock Duration:</strong> ${lockoutData.duration} minutes</p>
                    </div>

                    <h3>What happened?</h3>
                    <p>We detected ${lockoutData.attempts} failed login attempts for your account within a short period.</p>

                    <h3>What should you do?</h3>
                    <ul>
                        <li>Wait ${lockoutData.duration} minutes for the lockout to automatically expire</li>
                        <li>If this wasn't you, change your password immediately after the lockout expires</li>
                        <li>Contact support if you need immediate assistance</li>
                    </ul>

                    <p>If you didn't attempt to log in, please secure your account immediately.</p>
                </div>
                <div class="footer">
                    <p>TaskFlow Pro Security Team</p>
                </div>
            </div>
        </body>
        </html>`;

        const text = `
TaskFlow Account Security Alert

Your account has been temporarily locked due to multiple failed login attempts.

Lockout Details:
- Time: ${new Date(lockoutData.timestamp).toLocaleString()}
- Failed Attempts: ${lockoutData.attempts}
- Lock Duration: ${lockoutData.duration} minutes

If this wasn't you, please secure your account immediately.

TaskFlow Pro Security Team
        `;

        return { html, text };
    }

    /**
     * Test email configuration
     */
    async testConnection() {
        if (!this.config.enabled || !this.transporter) {
            return { success: false, error: 'Email service not configured' };
        }

        try {
            await this.transporter.verify();
            return { success: true, message: 'Email service connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get email service status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            connected: !!this.transporter,
            host: this.config.host,
            port: this.config.port,
            from: this.config.from
        };
    }
}

module.exports = { EmailService };