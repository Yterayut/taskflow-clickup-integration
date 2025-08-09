/**
 * Account Security Service
 * Handles account lockout, failed login tracking, and brute force protection
 * 
 * SECURITY CRITICAL: Prevents brute force password attacks
 */

const crypto = require('crypto');

class AccountSecurityService {
    constructor(dbClient) {
        this.db = dbClient;
        
        // Security configuration
        this.maxFailedAttempts = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;
        this.lockoutDurationMinutes = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
        this.attemptWindowMinutes = parseInt(process.env.ATTEMPT_WINDOW_MINUTES) || 60;
        this.captchaThreshold = parseInt(process.env.CAPTCHA_THRESHOLD) || 3;
        
        console.log(`🛡️  Account Security initialized: ${this.maxFailedAttempts} attempts, ${this.lockoutDurationMinutes}min lockout`);
    }
    
    /**
     * Check if account is currently locked
     */
    async isAccountLocked(email) {
        try {
            const result = await this.db.query(`
                SELECT 
                    failed_attempts,
                    last_failed_attempt,
                    locked_until,
                    lockout_count
                FROM user_security 
                WHERE email = $1
            `, [email.toLowerCase()]);
            
            if (result.rows.length === 0) {
                return {
                    isLocked: false,
                    needsCaptcha: false,
                    remainingAttempts: this.maxFailedAttempts,
                    lockoutInfo: null
                };
            }
            
            const security = result.rows[0];
            const now = new Date();
            
            // Check if currently locked
            if (security.locked_until && security.locked_until > now) {
                const minutesRemaining = Math.ceil((security.locked_until - now) / (1000 * 60));
                return {
                    isLocked: true,
                    needsCaptcha: true,
                    remainingAttempts: 0,
                    lockoutInfo: {
                        lockedUntil: security.locked_until,
                        minutesRemaining,
                        lockoutCount: security.lockout_count || 0
                    }
                };
            }
            
            // Check if needs CAPTCHA (after 3 failed attempts)
            const needsCaptcha = security.failed_attempts >= this.captchaThreshold;
            const remainingAttempts = Math.max(0, this.maxFailedAttempts - security.failed_attempts);
            
            return {
                isLocked: false,
                needsCaptcha,
                remainingAttempts,
                lockoutInfo: null
            };
            
        } catch (error) {
            console.error('❌ Error checking account lock status:', error);
            // Fail secure - treat as potentially locked
            return {
                isLocked: true,
                needsCaptcha: true,
                remainingAttempts: 0,
                lockoutInfo: { error: 'Security check failed' }
            };
        }
    }
    
    /**
     * Record successful login (reset failed attempts)
     */
    async recordSuccessfulLogin(email, ipAddress = null, userAgent = null) {
        try {
            await this.db.query(`
                INSERT INTO user_security (
                    email, failed_attempts, last_failed_attempt, 
                    locked_until, last_successful_login, last_login_ip,
                    last_user_agent, updated_at
                ) VALUES ($1, 0, NULL, NULL, NOW(), $2, $3, NOW())
                ON CONFLICT (email) 
                DO UPDATE SET
                    failed_attempts = 0,
                    last_failed_attempt = NULL,
                    locked_until = NULL,
                    last_successful_login = NOW(),
                    last_login_ip = $2,
                    last_user_agent = $3,
                    updated_at = NOW()
            `, [email.toLowerCase(), ipAddress, userAgent]);
            
            console.log(`✅ Successful login recorded for ${email}`);
            
        } catch (error) {
            console.error('❌ Error recording successful login:', error);
            // Don't throw - successful login shouldn't fail due to audit issues
        }
    }
    
    /**
     * Record failed login attempt and check for lockout
     */
    async recordFailedLoginAttempt(email, ipAddress = null, userAgent = null) {
        try {
            const now = new Date();
            
            // Get current security record
            const currentResult = await this.db.query(`
                SELECT failed_attempts, last_failed_attempt, lockout_count
                FROM user_security 
                WHERE email = $1
            `, [email.toLowerCase()]);
            
            let failedAttempts = 1;
            let lockoutCount = 0;
            let shouldLock = false;
            
            if (currentResult.rows.length > 0) {
                const current = currentResult.rows[0];
                lockoutCount = current.lockout_count || 0;
                
                // Check if this is within the attempt window
                const windowStart = new Date(now.getTime() - (this.attemptWindowMinutes * 60 * 1000));
                
                if (current.last_failed_attempt && current.last_failed_attempt > windowStart) {
                    // Within window, increment attempts
                    failedAttempts = current.failed_attempts + 1;
                } else {
                    // Outside window, reset to 1
                    failedAttempts = 1;
                }
            }
            
            // Check if should lock account
            if (failedAttempts >= this.maxFailedAttempts) {
                shouldLock = true;
                lockoutCount += 1;
                failedAttempts = this.maxFailedAttempts; // Cap at max
            }
            
            const lockedUntil = shouldLock ? 
                new Date(now.getTime() + (this.lockoutDurationMinutes * 60 * 1000)) : 
                null;
            
            // Update security record
            await this.db.query(`
                INSERT INTO user_security (
                    email, failed_attempts, last_failed_attempt,
                    locked_until, lockout_count, last_failed_ip,
                    last_failed_user_agent, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (email)
                DO UPDATE SET
                    failed_attempts = $2,
                    last_failed_attempt = $3,
                    locked_until = $4,
                    lockout_count = $5,
                    last_failed_ip = $6,
                    last_failed_user_agent = $7,
                    updated_at = NOW()
            `, [
                email.toLowerCase(),
                failedAttempts,
                now,
                lockedUntil,
                lockoutCount,
                ipAddress,
                userAgent
            ]);
            
            if (shouldLock) {
                console.log(`🔒 Account locked: ${email} for ${this.lockoutDurationMinutes} minutes (lockout #${lockoutCount})`);
            } else {
                console.log(`⚠️  Failed login attempt ${failedAttempts}/${this.maxFailedAttempts} for ${email}`);
            }
            
            return {
                isLocked: shouldLock,
                failedAttempts,
                maxAttempts: this.maxFailedAttempts,
                lockoutDurationMinutes: this.lockoutDurationMinutes,
                lockoutCount,
                lockedUntil,
                needsCaptcha: failedAttempts >= this.captchaThreshold
            };
            
        } catch (error) {
            console.error('❌ Error recording failed login attempt:', error);
            throw error;
        }
    }
    
    /**
     * Manually unlock account (admin function)
     */
    async unlockAccount(email, adminEmail = null) {
        try {
            const result = await this.db.query(`
                UPDATE user_security 
                SET 
                    failed_attempts = 0,
                    locked_until = NULL,
                    last_failed_attempt = NULL,
                    updated_at = NOW()
                WHERE email = $1
                RETURNING lockout_count
            `, [email.toLowerCase()]);
            
            if (result.rows.length > 0) {
                console.log(`🔓 Account unlocked: ${email} by ${adminEmail || 'system'}`);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Error unlocking account:', error);
            throw error;
        }
    }
    
    /**
     * Get security statistics for an account
     */
    async getAccountSecurityInfo(email) {
        try {
            const result = await this.db.query(`
                SELECT * FROM user_security WHERE email = $1
            `, [email.toLowerCase()]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const security = result.rows[0];
            const now = new Date();
            
            return {
                email: security.email,
                failedAttempts: security.failed_attempts,
                maxAttempts: this.maxFailedAttempts,
                isCurrentlyLocked: security.locked_until && security.locked_until > now,
                lockedUntil: security.locked_until,
                lockoutCount: security.lockout_count || 0,
                lastFailedAttempt: security.last_failed_attempt,
                lastSuccessfulLogin: security.last_successful_login,
                lastLoginIp: security.last_login_ip,
                needsCaptcha: security.failed_attempts >= this.captchaThreshold
            };
            
        } catch (error) {
            console.error('❌ Error getting account security info:', error);
            throw error;
        }
    }
    
    /**
     * Get system-wide security statistics
     */
    async getSecurityStatistics() {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_accounts,
                    COUNT(CASE WHEN locked_until > NOW() THEN 1 END) as currently_locked,
                    COUNT(CASE WHEN failed_attempts > 0 THEN 1 END) as accounts_with_failures,
                    COUNT(CASE WHEN failed_attempts >= $1 THEN 1 END) as accounts_needing_captcha,
                    AVG(failed_attempts) as avg_failed_attempts,
                    SUM(lockout_count) as total_lockouts,
                    MAX(lockout_count) as max_lockouts_per_account
                FROM user_security
            `, [this.captchaThreshold]);
            
            const stats = result.rows[0];
            
            // Recent activity (last 24 hours)
            const recentResult = await this.db.query(`
                SELECT 
                    COUNT(CASE WHEN last_failed_attempt > NOW() - INTERVAL '24 hours' THEN 1 END) as failed_attempts_24h,
                    COUNT(CASE WHEN last_successful_login > NOW() - INTERVAL '24 hours' THEN 1 END) as successful_logins_24h,
                    COUNT(CASE WHEN locked_until > NOW() - INTERVAL '24 hours' THEN 1 END) as lockouts_24h
                FROM user_security
            `);
            
            const recent = recentResult.rows[0];
            
            return {
                ...stats,
                ...recent,
                security_config: {
                    maxFailedAttempts: this.maxFailedAttempts,
                    lockoutDurationMinutes: this.lockoutDurationMinutes,
                    attemptWindowMinutes: this.attemptWindowMinutes,
                    captchaThreshold: this.captchaThreshold
                }
            };
            
        } catch (error) {
            console.error('❌ Error getting security statistics:', error);
            throw error;
        }
    }
    
    /**
     * Clean up old security records (maintenance)
     */
    async cleanupOldRecords(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const result = await this.db.query(`
                DELETE FROM user_security 
                WHERE 
                    failed_attempts = 0 
                    AND locked_until IS NULL 
                    AND last_failed_attempt < $1
                    AND last_successful_login < $1
            `, [cutoffDate]);
            
            console.log(`🧹 Cleaned up ${result.rowCount} old security records`);
            return result.rowCount;
            
        } catch (error) {
            console.error('❌ Error cleaning up old security records:', error);
            throw error;
        }
    }
    
    /**
     * Generate secure session token for account unlock requests
     */
    generateSecureToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Health check for security service
     */
    async healthCheck() {
        try {
            await this.db.query('SELECT 1 FROM user_security LIMIT 1');
            return {
                status: 'healthy',
                config: {
                    maxFailedAttempts: this.maxFailedAttempts,
                    lockoutDurationMinutes: this.lockoutDurationMinutes,
                    captchaThreshold: this.captchaThreshold
                }
            };
        } catch (error) {
            throw new Error('Account security service health check failed');
        }
    }
}

module.exports = { AccountSecurityService };