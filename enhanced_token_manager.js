/**
 * Enhanced ClickUp Token Manager
 * Comprehensive solution for long-lasting master user tokens
 */
const fs = require('fs').promises;
const path = require('path');

class EnhancedTokenManager {
    constructor(tokenFilePath = './master_clickup_token.json') {
        this.tokenFilePath = tokenFilePath;
        this.refreshGracePeriod = 24 * 60 * 60 * 1000; // 24 hours before expiry
        this.maxRetryAttempts = 3;
    }

    /**
     * Enhanced token storage format
     */
    async saveEnhancedToken(tokenData) {
        const enhancedToken = {
            // OAuth data
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type || 'Bearer',
            scope: tokenData.scope,
            
            // Expiry tracking
            expiresIn: tokenData.expires_in || 3600,
            expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
            refreshAfter: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000 - this.refreshGracePeriod).toISOString(),
            
            // User context
            clickupUserId: tokenData.clickupUserId,
            clickupUsername: tokenData.clickupUsername,
            clickupEmail: tokenData.clickupEmail,
            userEmail: tokenData.userEmail,
            
            // Management metadata
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            lastRefreshed: null,
            refreshAttempts: 0,
            maxRefreshAttempts: this.maxRetryAttempts,
            
            // Status tracking
            isActive: true,
            autoRefreshEnabled: true,
            nextRefreshCheck: new Date(Date.now() + 5 * 60 * 1000).toISOString() // Check every 5 minutes
        };
        
        await fs.writeFile(this.tokenFilePath, JSON.stringify(enhancedToken, null, 2));
        console.log('✅ Enhanced token saved with refresh capability');
        return enhancedToken;
    }

    /**
     * Load current token with validation
     */
    async loadToken() {
        try {
            const tokenData = await fs.readFile(this.tokenFilePath, 'utf8');
            return JSON.parse(tokenData);
        } catch (error) {
            console.warn('⚠️ Token file not found or invalid');
            return null;
        }
    }

    /**
     * Check if token needs refresh
     */
    isTokenExpired(token) {
        if (!token?.expiresAt) return true;
        return new Date() >= new Date(token.expiresAt);
    }

    needsRefresh(token) {
        if (!token?.refreshAfter) return true;
        return new Date() >= new Date(token.refreshAfter);
    }

    canAttemptRefresh(token) {
        return token?.refreshToken && 
               token?.refreshAttempts < token?.maxRefreshAttempts &&
               token?.isActive;
    }

    /**
     * Update token usage
     */
    async updateLastUsed(token) {
        token.lastUsed = new Date().toISOString();
        await fs.writeFile(this.tokenFilePath, JSON.stringify(token, null, 2));
    }

    /**
     * Record refresh attempt
     */
    async recordRefreshAttempt(token, success = false) {
        token.refreshAttempts = (token.refreshAttempts || 0) + 1;
        token.lastRefreshed = new Date().toISOString();
        
        if (success) {
            token.refreshAttempts = 0; // Reset on success
            token.nextRefreshCheck = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        }
        
        await fs.writeFile(this.tokenFilePath, JSON.stringify(token, null, 2));
    }

    /**
     * Create backup before modification
     */
    async createBackup() {
        try {
            const token = await this.loadToken();
            if (token) {
                const backupPath = `${this.tokenFilePath}.backup.${Date.now()}`;
                await fs.writeFile(backupPath, JSON.stringify(token, null, 2));
                console.log(`📁 Token backup created: ${backupPath}`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to create token backup:', error.message);
        }
    }

    /**
     * Migrate legacy token format
     */
    async migrateLegacyToken() {
        const token = await this.loadToken();
        
        if (!token) {
            console.log('🆕 No existing token to migrate');
            return null;
        }

        // Check if already enhanced format
        if (token.refreshToken && token.expiresAt) {
            console.log('✅ Token already in enhanced format');
            return token;
        }

        console.log('🔄 Migrating legacy token format...');
        await this.createBackup();

        // Legacy token detected - needs re-authentication
        const migrationInfo = {
            ...token,
            migrationRequired: true,
            migrationReason: 'Legacy token format lacks refresh capability',
            migrationDate: new Date().toISOString(),
            originalFormat: 'legacy_access_token_only'
        };

        await fs.writeFile(this.tokenFilePath + '.migration_needed', JSON.stringify(migrationInfo, null, 2));
        
        return {
            migrationRequired: true,
            legacyToken: token,
            message: 'Token migration required - master user must re-authenticate'
        };
    }

    /**
     * Get token status for UI display
     */
    async getTokenStatus() {
        const token = await this.loadToken();
        
        if (!token) {
            return {
                status: 'missing',
                message: 'No ClickUp token found',
                action: 'oauth_required',
                color: 'red'
            };
        }

        if (token.migrationRequired) {
            return {
                status: 'migration_required',
                message: 'Token format migration required',
                action: 'oauth_required',
                color: 'orange',
                details: token
            };
        }

        if (this.isTokenExpired(token)) {
            if (this.canAttemptRefresh(token)) {
                return {
                    status: 'expired_refreshable',
                    message: 'Token expired but can be refreshed',
                    action: 'auto_refresh',
                    color: 'yellow',
                    expiresAt: token.expiresAt,
                    refreshAttempts: token.refreshAttempts
                };
            } else {
                return {
                    status: 'expired_failed',
                    message: 'Token expired and refresh failed',
                    action: 'oauth_required',
                    color: 'red',
                    refreshAttempts: token.refreshAttempts
                };
            }
        }

        if (this.needsRefresh(token)) {
            return {
                status: 'needs_refresh',
                message: 'Token will expire soon',
                action: 'proactive_refresh',
                color: 'yellow',
                expiresAt: token.expiresAt,
                timeUntilExpiry: Math.floor((new Date(token.expiresAt) - new Date()) / (1000 * 60)) + ' minutes'
            };
        }

        return {
            status: 'valid',
            message: 'Token is valid and active',
            action: 'none',
            color: 'green',
            expiresAt: token.expiresAt,
            timeUntilExpiry: Math.floor((new Date(token.expiresAt) - new Date()) / (1000 * 60)) + ' minutes',
            lastUsed: token.lastUsed
        };
    }

    /**
     * Generate OAuth URL for re-authentication
     */
    generateOAuthUrl() {
        const params = new URLSearchParams({
            client_id: process.env.CLICKUP_CLIENT_ID,
            redirect_uri: process.env.CLICKUP_REDIRECT_URI,
            response_type: 'code',
            scope: 'read',
            state: `taskflow_reauth_${Date.now()}_${Math.random().toString(36).substring(7)}`
        });
        
        return `https://app.clickup.com/api?${params.toString()}`;
    }
}

module.exports = { EnhancedTokenManager };