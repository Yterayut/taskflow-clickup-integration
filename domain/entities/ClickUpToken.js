/**
 * ClickUpToken Entity
 * Manages ClickUp OAuth tokens with expiration and refresh logic
 */
class ClickUpToken {
    constructor({
        id = null,
        userId,
        accessToken,
        refreshToken = null,
        expiresAt,
        scope = null,
        tokenType = 'Bearer',
        lastRefreshAttempt = null,
        refreshAttemptsCount = 0,
        isPermanent = false,
        setupCompletedAt = null,
        createdAt = null,
        updatedAt = null
    }) {
        this.id = id;
        this.userId = userId;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresAt = expiresAt;
        this.scope = scope;
        this.tokenType = tokenType;
        this.lastRefreshAttempt = lastRefreshAttempt;
        this.refreshAttemptsCount = refreshAttemptsCount;
        this.isPermanent = isPermanent;
        this.setupCompletedAt = setupCompletedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
    
    /**
     * Check if token is expired
     */
    isExpired() {
        // Permanent tokens never expire
        if (this.isPermanent) {
            return false;
        }
        
        if (!this.expiresAt) {
            return true;
        }
        return new Date() >= this.expiresAt;
    }
    
    /**
     * Check if token needs refresh (considering buffer time)
     */
    needsRefresh() {
        // Permanent tokens don't need refresh
        if (this.isPermanent) {
            return false;
        }
        
        if (!this.expiresAt) {
            return true;
        }
        
        const bufferMinutes = parseInt(process.env.TOKEN_REFRESH_BUFFER_MINUTES) || 30;
        const bufferMs = bufferMinutes * 60 * 1000;
        const refreshThreshold = new Date(this.expiresAt.getTime() - bufferMs);
        
        return new Date() >= refreshThreshold;
    }
    
    /**
     * Check if token is within grace period for expired tokens
     */
    isWithinGracePeriod() {
        if (!this.expiresAt) {
            return false;
        }
        
        const gracePeriodDays = this.parseGracePeriod();
        const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
        const graceThreshold = new Date(this.expiresAt.getTime() + gracePeriodMs);
        
        return new Date() <= graceThreshold;
    }
    
    /**
     * Parse grace period from environment variable
     */
    parseGracePeriod() {
        const gracePeriod = process.env.TOKEN_GRACE_PERIOD || '7d';
        const match = gracePeriod.match(/^(\d+)([dwhy])$/);
        
        if (!match) {
            return 7; // Default 7 days
        }
        
        const [, number, unit] = match;
        const value = parseInt(number);
        
        switch (unit) {
            case 'd': return value;
            case 'w': return value * 7;
            case 'h': return value / 24;
            case 'y': return value * 365;
            default: return 7;
        }
    }
    
    /**
     * Get time until expiry in minutes
     */
    getTimeUntilExpiry() {
        if (!this.expiresAt) {
            return 0;
        }
        
        const diffMs = this.expiresAt.getTime() - Date.now();
        return Math.max(0, Math.floor(diffMs / (1000 * 60)));
    }
    
    /**
     * Check if refresh should be attempted
     */
    canAttemptRefresh() {
        if (!this.refreshToken) {
            return false;
        }
        
        // Don't attempt refresh if too many recent failures
        const maxAttempts = 3;
        const attemptWindow = 60 * 60 * 1000; // 1 hour
        
        if (this.refreshAttemptsCount >= maxAttempts) {
            if (this.lastRefreshAttempt && 
                (Date.now() - this.lastRefreshAttempt.getTime()) < attemptWindow) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Update token with new values from refresh
     */
    updateFromRefresh({
        accessToken,
        refreshToken = null,
        expiresAt,
        scope = null
    }) {
        this.accessToken = accessToken;
        
        // Update refresh token if provided
        if (refreshToken) {
            this.refreshToken = refreshToken;
        }
        
        this.expiresAt = expiresAt;
        
        if (scope) {
            this.scope = scope;
        }
        
        // Reset refresh attempt tracking on successful refresh
        this.refreshAttemptsCount = 0;
        this.lastRefreshAttempt = new Date();
        this.updatedAt = new Date();
    }
    
    /**
     * Record failed refresh attempt
     */
    recordFailedRefreshAttempt() {
        this.refreshAttemptsCount += 1;
        this.lastRefreshAttempt = new Date();
        this.updatedAt = new Date();
    }
    
    /**
     * Revoke token (mark as invalid)
     */
    revoke() {
        this.accessToken = null;
        this.refreshToken = null;
        this.expiresAt = new Date(); // Set to now to mark as expired
        this.updatedAt = new Date();
    }
    
    /**
     * Get authorization header value
     */
    getAuthorizationHeader() {
        if (!this.accessToken) {
            return null;
        }
        return `${this.tokenType} ${this.accessToken}`;
    }
    
    /**
     * Convert to database object
     */
    toDatabaseObject() {
        return {
            id: this.id,
            user_id: this.userId,
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            expires_at: this.expiresAt,
            scope: this.scope,
            token_type: this.tokenType,
            last_refresh_attempt: this.lastRefreshAttempt,
            refresh_attempts_count: this.refreshAttemptsCount,
            is_permanent: this.isPermanent,
            setup_completed_at: this.setupCompletedAt,
            created_at: this.createdAt,
            updated_at: this.updatedAt
        };
    }
    
    /**
     * Create ClickUpToken from database row
     */
    static fromDatabaseRow(row) {
        return new ClickUpToken({
            id: row.id,
            userId: row.user_id,
            accessToken: row.access_token,
            refreshToken: row.refresh_token,
            expiresAt: row.expires_at,
            scope: row.scope,
            tokenType: row.token_type,
            lastRefreshAttempt: row.last_refresh_attempt,
            refreshAttemptsCount: row.refresh_attempts_count,
            isPermanent: row.is_permanent || false,
            setupCompletedAt: row.setup_completed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        });
    }
    
    /**
     * Create new token from OAuth response
     */
    static fromOAuthResponse(userId, oauthData) {
        const expiresAt = new Date(Date.now() + (oauthData.expires_in * 1000));
        
        return new ClickUpToken({
            userId,
            accessToken: oauthData.access_token,
            refreshToken: oauthData.refresh_token,
            expiresAt,
            scope: oauthData.scope,
            tokenType: oauthData.token_type || 'Bearer',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
}

module.exports = { ClickUpToken };