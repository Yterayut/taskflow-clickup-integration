/**
 * Background Authentication Integration Service
 * Integrates BackgroundAuthService with existing authentication system
 * Provides seamless migration and operational management
 */

const { BackgroundAuthService } = require('./BackgroundAuthService');
const { SecureCredentialStorage } = require('../../infrastructure/storage/SecureCredentialStorage');

class BackgroundAuthIntegration {
    constructor(clickupOAuthAdapter, systemService, logger = console) {
        this.clickupOAuthAdapter = clickupOAuthAdapter;
        this.systemService = systemService;
        this.logger = logger;
        
        // Initialize secure storage
        this.secureStorage = new SecureCredentialStorage({
            logger: this.logger,
            storageDir: process.env.SECURE_STORAGE_DIR || './.secure'
        });
        
        // Initialize background auth service
        this.backgroundAuthService = new BackgroundAuthService(
            this.clickupOAuthAdapter,
            this.secureStorage,
            this.logger
        );
        
        this.isInitialized = false;
        this.migrationCompleted = false;
    }

    /**
     * Initialize the background authentication system
     */
    async initialize() {
        try {
            this.logger.log('🚀 Initializing Background Authentication Integration...');
            
            // Initialize secure storage
            await this.secureStorage.initialize();
            
            // Migrate existing token if available
            await this.migrateExistingToken();
            
            // Start background authentication service
            const result = await this.backgroundAuthService.start();
            
            this.isInitialized = true;
            
            this.logger.log('✅ Background Authentication Integration initialized successfully');
            
            return {
                success: true,
                message: 'Background authentication integration initialized',
                migration: this.migrationCompleted,
                backgroundService: result
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Background Authentication Integration:', error);
            throw error;
        }
    }

    /**
     * Migrate existing master token to secure storage
     */
    async migrateExistingToken() {
        try {
            this.logger.log('🔄 Checking for existing token migration...');
            
            // Check if token already migrated
            const existingToken = await this.secureStorage.getStoredToken();
            if (existingToken) {
                this.logger.log('✅ Token already migrated to secure storage');
                this.migrationCompleted = true;
                return;
            }
            
            // Look for legacy token file
            const legacyTokenPath = './master_clickup_token.json';
            
            try {
                const fs = require('fs').promises;
                const legacyTokenData = await fs.readFile(legacyTokenPath, 'utf8');
                const tokenData = JSON.parse(legacyTokenData);
                
                this.logger.log('📦 Found legacy token, migrating to secure storage...');
                
                // Validate and enhance token data
                const enhancedTokenData = {
                    accessToken: tokenData.accessToken,
                    tokenType: tokenData.tokenType || 'Bearer',
                    userEmail: tokenData.userEmail,
                    lastUsed: tokenData.lastUsed || new Date().toISOString(),
                    migratedFrom: 'legacy_file',
                    migratedAt: new Date().toISOString(),
                    // Add refresh token if available
                    refreshToken: tokenData.refreshToken || null
                };
                
                // Store in secure storage
                await this.secureStorage.storeToken(enhancedTokenData);
                
                // Backup legacy file
                await fs.rename(legacyTokenPath, `${legacyTokenPath}.backup`);
                
                this.logger.log('✅ Token migration completed successfully');
                this.migrationCompleted = true;
                
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.logger.log('ℹ️ No legacy token file found - starting fresh');
                } else {
                    this.logger.warn('⚠️ Token migration failed:', error.message);
                }
            }
            
        } catch (error) {
            this.logger.error('❌ Token migration error:', error);
            // Don't throw - migration is optional
        }
    }

    /**
     * Get current authentication status
     */
    async getAuthStatus() {
        try {
            if (!this.isInitialized) {
                return {
                    status: 'not_initialized',
                    message: 'Background authentication not initialized'
                };
            }
            
            // Get background service status
            const backgroundStatus = this.backgroundAuthService.getStatus();
            
            // Get stored token info
            const storedToken = await this.secureStorage.getStoredToken();
            
            // Get storage status
            const storageStatus = await this.secureStorage.getStatus();
            
            // Calculate operational status
            const isOperational = backgroundStatus.isHealthy && !!storedToken;
            
            return {
                status: isOperational ? 'operational' : 'requires_attention',
                background_service: backgroundStatus,
                stored_token: {
                    available: !!storedToken,
                    user_email: storedToken?.userEmail,
                    last_used: storedToken?.lastUsed,
                    migrated: this.migrationCompleted
                },
                storage: storageStatus,
                system_operational: isOperational
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to get auth status:', error);
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Force token refresh (manual override)
     */
    async forceTokenRefresh() {
        try {
            this.logger.log('🔄 Manual token refresh requested...');
            
            if (!this.isInitialized) {
                throw new Error('Background authentication not initialized');
            }
            
            const result = await this.backgroundAuthService.forceRefresh();
            
            this.logger.log('✅ Manual token refresh completed');
            
            return {
                success: true,
                result: result,
                timestamp: new Date()
            };
            
        } catch (error) {
            this.logger.error('❌ Manual token refresh failed:', error);
            throw error;
        }
    }

    /**
     * Setup initial master credentials for automatic refresh
     */
    async setupMasterCredentials(masterUserData) {
        try {
            this.logger.log('🔐 Setting up master credentials for automatic refresh...');
            
            const credentials = {
                email: masterUserData.email,
                oauthRefreshToken: masterUserData.refreshToken,
                clientId: process.env.CLICKUP_CLIENT_ID,
                setupAt: new Date().toISOString()
            };
            
            await this.secureStorage.storeCredentials(credentials);
            
            this.logger.log('✅ Master credentials setup completed');
            
            return {
                success: true,
                message: 'Master credentials stored securely'
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to setup master credentials:', error);
            throw error;
        }
    }

    /**
     * Handle new OAuth completion - store token and setup credentials
     */
    async handleOAuthCompletion(tokenData, userInfo) {
        try {
            this.logger.log('🔄 Processing OAuth completion for background auth...');
            
            // Store the new token
            const enhancedTokenData = {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                tokenType: tokenData.token_type || 'Bearer',
                userEmail: userInfo.email,
                lastUsed: new Date().toISOString(),
                obtainedAt: new Date().toISOString(),
                expiresIn: tokenData.expires_in
            };
            
            await this.secureStorage.storeToken(enhancedTokenData);
            
            // Setup credentials for future automatic refresh
            if (tokenData.refresh_token) {
                await this.setupMasterCredentials({
                    email: userInfo.email,
                    refreshToken: tokenData.refresh_token
                });
            }
            
            this.logger.log('✅ OAuth completion processed for background auth');
            
            return {
                success: true,
                message: 'OAuth completion processed',
                hasRefreshToken: !!tokenData.refresh_token
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to process OAuth completion:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive system status
     */
    async getSystemStatus() {
        try {
            const authStatus = await this.getAuthStatus();
            const auditLogs = await this.secureStorage.getAuditLogs(10);
            
            return {
                timestamp: new Date(),
                authentication: authStatus,
                recent_activity: auditLogs,
                integration_status: {
                    initialized: this.isInitialized,
                    migration_completed: this.migrationCompleted
                }
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to get system status:', error);
            return {
                timestamp: new Date(),
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Update background service configuration
     */
    updateBackgroundConfig(newConfig) {
        if (!this.isInitialized) {
            throw new Error('Background authentication not initialized');
        }
        
        this.backgroundAuthService.updateConfig(newConfig);
        
        this.logger.log('⚙️ Background authentication configuration updated');
        
        return {
            success: true,
            message: 'Configuration updated',
            new_config: newConfig
        };
    }

    /**
     * Emergency stop - disable background authentication
     */
    async emergencyStop() {
        try {
            this.logger.warn('🚨 Emergency stop requested for background authentication');
            
            if (this.backgroundAuthService.isRunning) {
                this.backgroundAuthService.stop();
            }
            
            this.logger.log('✅ Background authentication stopped');
            
            return {
                success: true,
                message: 'Background authentication stopped',
                timestamp: new Date()
            };
            
        } catch (error) {
            this.logger.error('❌ Emergency stop failed:', error);
            throw error;
        }
    }

    /**
     * Clear all stored data (emergency reset)
     */
    async emergencyReset() {
        try {
            this.logger.warn('🚨 Emergency reset requested - clearing all stored data');
            
            // Stop background service
            await this.emergencyStop();
            
            // Clear stored data
            await this.secureStorage.clearStoredData();
            
            this.isInitialized = false;
            this.migrationCompleted = false;
            
            this.logger.log('✅ Emergency reset completed');
            
            return {
                success: true,
                message: 'All data cleared - system reset to initial state',
                timestamp: new Date()
            };
            
        } catch (error) {
            this.logger.error('❌ Emergency reset failed:', error);
            throw error;
        }
    }

    /**
     * Get current stored token (for compatibility with existing system)
     */
    async getCurrentToken() {
        try {
            const tokenData = await this.secureStorage.getStoredToken();
            
            if (!tokenData) {
                return null;
            }
            
            // Return in legacy format for compatibility
            return {
                accessToken: tokenData.accessToken,
                tokenType: tokenData.tokenType,
                userEmail: tokenData.userEmail,
                lastUsed: tokenData.lastUsed
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to get current token:', error);
            return null;
        }
    }

    /**
     * Check if system is operational
     */
    async isSystemOperational() {
        try {
            const status = await this.getAuthStatus();
            return status.system_operational === true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = { BackgroundAuthIntegration };