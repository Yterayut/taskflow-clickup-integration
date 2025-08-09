/**
 * Password Reset Application Service
 * TaskFlow Pro v2.2 - Self-service password reset functionality
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

class PasswordResetService {
    constructor({
        userRepository,
        tokenRepository,
        auditLoggingService,
        emailConfig
    }) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.auditLoggingService = auditLoggingService;
        this.emailConfig = emailConfig;
        
        // Configuration
        this.config = {
            tokenExpiryMinutes: 15,
            maxAttemptsPerEmail: 3,
            maxAttemptsWindow: 3600000, // 1 hour in milliseconds
            minPasswordLength: 8,
            maxPasswordLength: 100,
            saltRounds: 12
        };

        this.initializeEmailTransporter();
    }

    initializeEmailTransporter() {
        if (this.emailConfig && this.emailConfig.enabled) {
            this.emailTransporter = nodemailer.createTransporter({
                host: this.emailConfig.host,
                port: this.emailConfig.port || 587,
                secure: this.emailConfig.secure || false,
                auth: {
                    user: this.emailConfig.user,
                    pass: this.emailConfig.password
                }
            });
        }
    }

    /**
     * Initiate password reset process
     */
    async initiatePasswordReset(email, clientIP, userAgent) {
        try {
            // Validate email format
            if (!this.isValidEmail(email)) {
                throw new Error('Invalid email format');
            }

            // Check rate limiting
            await this.checkRateLimit(email, clientIP);

            // Find user
            const user = await this.userRepository.findByEmail(email);
            if (!user) {
                // Don't reveal if email exists, but log the attempt
                await this.auditLoggingService.logEvent({
                    action: 'password_reset_attempt_unknown_email',
                    details: { email, clientIP, userAgent },
                    riskLevel: 'medium'
                });
                
                // Return success to prevent email enumeration
                return {
                    success: true,
                    message: 'If this email exists in our system, you will receive password reset instructions.'
                };
            }

            // Check if user can reset password (not OAuth-only users)
            if (!user.canUseLocalAuth()) {
                await this.auditLoggingService.logEvent({
                    userId: user.id,
                    action: 'password_reset_attempt_oauth_user',
                    details: { email, clientIP, userAgent },
                    riskLevel: 'medium'
                });

                throw new Error('This account uses OAuth authentication and cannot reset password this way');
            }

            // Generate reset token
            const resetToken = this.generateResetToken();
            const tokenHash = this.hashToken(resetToken);
            const expiresAt = new Date(Date.now() + (this.config.tokenExpiryMinutes * 60 * 1000));

            // Store reset token
            await this.tokenRepository.storeResetToken({
                userId: user.id,
                tokenHash,
                expiresAt,
                clientIP,
                userAgent,
                used: false
            });

            // Send reset email
            await this.sendResetEmail(user, resetToken);

            // Log successful initiation
            await this.auditLoggingService.logEvent({
                userId: user.id,
                action: 'password_reset_initiated',
                details: { email, clientIP, userAgent },
                riskLevel: 'medium'
            });

            return {
                success: true,
                message: 'Password reset instructions have been sent to your email address.'
            };

        } catch (error) {
            await this.auditLoggingService.logEvent({
                action: 'password_reset_initiation_failed',
                details: { 
                    email, 
                    error: error.message, 
                    clientIP, 
                    userAgent 
                },
                riskLevel: 'high'
            });
            throw error;
        }
    }

    /**
     * Validate reset token
     */
    async validateResetToken(token) {
        try {
            if (!token || typeof token !== 'string') {
                throw new Error('Invalid token format');
            }

            const tokenHash = this.hashToken(token);
            const tokenRecord = await this.tokenRepository.findResetToken(tokenHash);

            if (!tokenRecord) {
                throw new Error('Invalid or expired reset token');
            }

            if (tokenRecord.used) {
                await this.auditLoggingService.logEvent({
                    userId: tokenRecord.userId,
                    action: 'password_reset_token_reuse_attempt',
                    details: { tokenHash: tokenHash.substring(0, 10) + '...' },
                    riskLevel: 'high'
                });
                throw new Error('This reset token has already been used');
            }

            if (new Date() > tokenRecord.expiresAt) {
                await this.auditLoggingService.logEvent({
                    userId: tokenRecord.userId,
                    action: 'password_reset_token_expired',
                    details: { 
                        tokenHash: tokenHash.substring(0, 10) + '...',
                        expiredAt: tokenRecord.expiresAt
                    },
                    riskLevel: 'medium'
                });
                throw new Error('Reset token has expired');
            }

            const user = await this.userRepository.findById(tokenRecord.userId);
            if (!user || !user.isActive) {
                throw new Error('User account is not available');
            }

            return {
                valid: true,
                userId: user.id,
                email: user.email,
                expiresAt: tokenRecord.expiresAt
            };

        } catch (error) {
            await this.auditLoggingService.logEvent({
                action: 'password_reset_token_validation_failed',
                details: { error: error.message },
                riskLevel: 'medium'
            });
            throw error;
        }
    }

    /**
     * Complete password reset
     */
    async completePasswordReset(token, newPassword, clientIP, userAgent) {
        try {
            // Validate token first
            const tokenValidation = await this.validateResetToken(token);
            if (!tokenValidation.valid) {
                throw new Error('Invalid reset token');
            }

            // Validate new password
            this.validatePassword(newPassword);

            // Get user
            const user = await this.userRepository.findById(tokenValidation.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Hash new password
            const passwordHash = await bcrypt.hash(newPassword, this.config.saltRounds);

            // Update user password
            await this.userRepository.updatePassword(user.id, passwordHash);

            // Mark token as used
            const tokenHash = this.hashToken(token);
            await this.tokenRepository.markTokenAsUsed(tokenHash);

            // Invalidate all existing sessions for this user (security measure)
            await this.userRepository.invalidateAllSessions(user.id);

            // Log successful password reset
            await this.auditLoggingService.logEvent({
                userId: user.id,
                action: 'password_reset_completed',
                details: { 
                    email: user.email,
                    clientIP, 
                    userAgent 
                },
                riskLevel: 'high'
            });

            // Send confirmation email
            await this.sendPasswordResetConfirmationEmail(user);

            return {
                success: true,
                message: 'Password has been reset successfully. Please log in with your new password.'
            };

        } catch (error) {
            await this.auditLoggingService.logEvent({
                action: 'password_reset_completion_failed',
                details: { 
                    error: error.message,
                    clientIP, 
                    userAgent 
                },
                riskLevel: 'high'
            });
            throw error;
        }
    }

    /**
     * Cleanup expired tokens
     */
    async cleanupExpiredTokens() {
        try {
            const deletedCount = await this.tokenRepository.deleteExpiredTokens();
            
            if (deletedCount > 0) {
                await this.auditLoggingService.logEvent({
                    action: 'password_reset_tokens_cleaned',
                    details: { deletedCount },
                    riskLevel: 'low'
                });
            }

            return deletedCount;
        } catch (error) {
            await this.auditLoggingService.logEvent({
                action: 'password_reset_cleanup_failed',
                details: { error: error.message },
                riskLevel: 'low'
            });
            throw error;
        }
    }

    /**
     * Get reset attempt statistics
     */
    async getResetStatistics(period = 24) {
        try {
            const stats = await this.tokenRepository.getResetStatistics(period);
            
            return {
                period: `${period} hours`,
                totalAttempts: stats.totalAttempts,
                successfulResets: stats.successfulResets,
                expiredTokens: stats.expiredTokens,
                successRate: stats.totalAttempts > 0 
                    ? (stats.successfulResets / stats.totalAttempts * 100).toFixed(2)
                    : 0
            };
        } catch (error) {
            await this.auditLoggingService.logEvent({
                action: 'password_reset_statistics_failed',
                details: { error: error.message },
                riskLevel: 'low'
            });
            throw error;
        }
    }

    /**
     * Private helper methods
     */
    async checkRateLimit(email, clientIP) {
        const attempts = await this.tokenRepository.getRecentAttempts(
            email, 
            clientIP, 
            this.config.maxAttemptsWindow
        );

        if (attempts.length >= this.config.maxAttemptsPerEmail) {
            throw new Error(
                `Too many password reset attempts. Please wait ${Math.ceil(this.config.maxAttemptsWindow / 60000)} minutes before trying again.`
            );
        }
    }

    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            throw new Error('Password is required');
        }

        if (password.length < this.config.minPasswordLength) {
            throw new Error(`Password must be at least ${this.config.minPasswordLength} characters long`);
        }

        if (password.length > this.config.maxPasswordLength) {
            throw new Error(`Password cannot exceed ${this.config.maxPasswordLength} characters`);
        }

        // Additional password strength requirements
        if (!/(?=.*[a-z])/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }

        if (!/(?=.*[A-Z])/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }

        if (!/(?=.*\d)/.test(password)) {
            throw new Error('Password must contain at least one number');
        }

        if (!/(?=.*[@$!%*?&])/.test(password)) {
            throw new Error('Password must contain at least one special character (@$!%*?&)');
        }
    }

    async sendResetEmail(user, resetToken) {
        if (!this.emailTransporter) {
            console.warn('Email transporter not configured, skipping reset email');
            return;
        }

        const resetUrl = `${process.env.FRONTEND_URL || 'http://192.168.20.10:8888'}/reset-password?token=${resetToken}`;
        
        const emailContent = {
            from: this.emailConfig.from || this.emailConfig.user,
            to: user.email,
            subject: 'TaskFlow Pro - Password Reset Request',
            text: `
You have requested a password reset for your TaskFlow Pro account.

Click the link below to reset your password:
${resetUrl}

This link will expire in ${this.config.tokenExpiryMinutes} minutes.

If you did not request this password reset, please ignore this email.

Best regards,
TaskFlow Pro Team
            `,
            html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2563eb;">TaskFlow Pro - Password Reset Request</h2>
    
    <p>Hello ${user.fullName || user.email},</p>
    
    <p>You have requested a password reset for your TaskFlow Pro account.</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Your Password
        </a>
    </div>
    
    <p><strong>Important:</strong> This link will expire in ${this.config.tokenExpiryMinutes} minutes.</p>
    
    <p>If the button above doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    
    <p style="color: #666; font-size: 14px;">
        If you did not request this password reset, please ignore this email. 
        Your password will remain unchanged.
    </p>
    
    <p style="color: #666; font-size: 14px;">
        Best regards,<br>
        TaskFlow Pro Team
    </p>
</div>
            `
        };

        try {
            await this.emailTransporter.sendMail(emailContent);
            console.log(`Password reset email sent to: ${user.email}`);
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            throw new Error('Failed to send reset email. Please try again later.');
        }
    }

    async sendPasswordResetConfirmationEmail(user) {
        if (!this.emailTransporter) {
            return;
        }

        const emailContent = {
            from: this.emailConfig.from || this.emailConfig.user,
            to: user.email,
            subject: 'TaskFlow Pro - Password Reset Successful',
            text: `
Your TaskFlow Pro password has been successfully reset.

If you did not make this change, please contact your administrator immediately.

For security reasons, you have been logged out of all devices and will need to log in again.

Best regards,
TaskFlow Pro Team
            `,
            html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #10b981;">TaskFlow Pro - Password Reset Successful</h2>
    
    <p>Hello ${user.fullName || user.email},</p>
    
    <p>Your TaskFlow Pro password has been successfully reset.</p>
    
    <div style="background-color: #f0fdf4; border: 1px solid #22c55e; 
                border-radius: 5px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #16a34a;">
            ✓ Password reset completed successfully
        </p>
    </div>
    
    <p><strong>Important:</strong> For security reasons, you have been logged out of all devices 
       and will need to log in again with your new password.</p>
    
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    
    <p style="color: #dc2626; font-weight: bold;">
        If you did not make this change, please contact your administrator immediately.
    </p>
    
    <p style="color: #666; font-size: 14px;">
        Best regards,<br>
        TaskFlow Pro Team
    </p>
</div>
            `
        };

        try {
            await this.emailTransporter.sendMail(emailContent);
            console.log(`Password reset confirmation sent to: ${user.email}`);
        } catch (error) {
            console.error('Failed to send password reset confirmation:', error);
            // Don't throw error here as the reset was successful
        }
    }
}

module.exports = { PasswordResetService };