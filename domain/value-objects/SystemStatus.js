/**
 * SystemStatus Value Object
 * Represents the operational state of the system
 */
class SystemStatus {
    constructor({
        clickupConnected = false,
        tokenExpiresAt = null,
        lastRefresh = null,
        lastHealthCheck = null,
        activeSessionCount = 0,
        message = null
    }) {
        this.clickupConnected = clickupConnected;
        this.tokenExpiresAt = tokenExpiresAt;
        this.lastRefresh = lastRefresh;
        this.lastHealthCheck = lastHealthCheck;
        this.activeSessionCount = activeSessionCount;
        this.message = message;
    }
    
    /**
     * Check if the system is operational for user logins
     */
    isOperational() {
        return this.clickupConnected && !this.isTokenExpired();
    }
    
    /**
     * Check if the system is operational for regular users
     * Regular users can login even when ClickUp is not connected
     */
    isOperationalForRegularUsers() {
        return true; // Regular users don't need ClickUp integration
    }
    
    /**
     * Check if master user authentication is required
     */
    isMasterUserRequired() {
        return !this.clickupConnected || this.isTokenExpired();
    }
    
    /**
     * Check if token needs refresh soon
     */
    needsRefresh() {
        if (!this.tokenExpiresAt) {
            return false;
        }
        
        const bufferMinutes = parseInt(process.env.TOKEN_REFRESH_BUFFER_MINUTES) || 30;
        const bufferMs = bufferMinutes * 60 * 1000;
        const refreshThreshold = new Date(this.tokenExpiresAt.getTime() - bufferMs);
        
        return new Date() >= refreshThreshold;
    }
    
    /**
     * Check if token is expired
     */
    isTokenExpired() {
        if (!this.tokenExpiresAt) {
            return true;
        }
        return new Date() >= this.tokenExpiresAt;
    }
    
    /**
     * Get time until token expires (in minutes)
     */
    getTimeUntilExpiry() {
        if (!this.tokenExpiresAt) {
            return 0;
        }
        
        const diffMs = this.tokenExpiresAt.getTime() - Date.now();
        return Math.max(0, Math.floor(diffMs / (1000 * 60)));
    }
    
    /**
     * Get system status level
     */
    getStatusLevel() {
        if (!this.clickupConnected) {
            return 'error';
        }
        
        if (this.isTokenExpired()) {
            return 'error';
        }
        
        if (this.needsRefresh()) {
            return 'warning';
        }
        
        return 'healthy';
    }
    
    /**
     * Get human-readable status message
     */
    getStatusMessage() {
        if (this.message) {
            return this.message;
        }
        
        switch (this.getStatusLevel()) {
            case 'error':
                if (!this.clickupConnected) {
                    return 'ClickUp integration not configured. Master user must complete OAuth authentication.';
                }
                if (this.isTokenExpired()) {
                    return 'ClickUp token has expired. Master user needs to re-authenticate.';
                }
                return 'System is not operational';
                
            case 'warning':
                const minutes = this.getTimeUntilExpiry();
                return `ClickUp token expires in ${minutes} minutes. Auto-refresh will be attempted.`;
                
            case 'healthy':
                const hoursUntilExpiry = Math.floor(this.getTimeUntilExpiry() / 60);
                return `System operational. Token expires in ${hoursUntilExpiry} hours.`;
                
            default:
                return 'System status unknown';
        }
    }
    
    /**
     * Get user-type specific status messages
     */
    getStatusMessageForUserType(userType = 'regular') {
        if (this.message) {
            return this.message;
        }
        
        const isMaster = userType === 'master';
        
        switch (this.getStatusLevel()) {
            case 'error':
                if (!this.clickupConnected) {
                    return isMaster 
                        ? 'ClickUp integration not configured. Please complete OAuth authentication.'
                        : 'System available for regular users. ClickUp features temporarily disabled.';
                }
                if (this.isTokenExpired()) {
                    return isMaster
                        ? 'ClickUp token has expired. Please re-authenticate with ClickUp.'
                        : 'System available for regular users. ClickUp features temporarily disabled.';
                }
                return isMaster 
                    ? 'System is not operational for master user' 
                    : 'System available for regular users';
                
            case 'warning':
                const minutes = this.getTimeUntilExpiry();
                return `ClickUp token expires in ${minutes} minutes. Auto-refresh will be attempted.`;
                
            case 'healthy':
                const hoursUntilExpiry = Math.floor(this.getTimeUntilExpiry() / 60);
                return `System fully operational. Token expires in ${hoursUntilExpiry} hours.`;
                
            default:
                return 'System status unknown';
        }
    }
    
    /**
     * Create a system status for operational state
     */
    static operational(tokenExpiresAt, lastRefresh = null) {
        return new SystemStatus({
            clickupConnected: true,
            tokenExpiresAt,
            lastRefresh,
            lastHealthCheck: new Date()
        });
    }
    
    /**
     * Create a system status for non-operational state
     */
    static notOperational(message = null) {
        return new SystemStatus({
            clickupConnected: false,
            lastHealthCheck: new Date(),
            message
        });
    }
    
    /**
     * Convert to API response format
     */
    toApiResponse() {
        return {
            clickup_connected: this.clickupConnected,
            is_operational: this.isOperational(),
            is_operational_for_regular_users: this.isOperationalForRegularUsers(),
            master_user_required: this.isMasterUserRequired(),
            status_level: this.getStatusLevel(),
            message: this.getStatusMessage(),
            message_for_master: this.getStatusMessageForUserType('master'),
            message_for_regular: this.getStatusMessageForUserType('regular'),
            expires_at: this.tokenExpiresAt,
            last_refresh: this.lastRefresh,
            last_health_check: this.lastHealthCheck,
            active_sessions: this.activeSessionCount,
            time_until_expiry_minutes: this.getTimeUntilExpiry()
        };
    }
}

module.exports = { SystemStatus };