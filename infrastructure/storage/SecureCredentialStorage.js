/**
 * Secure Credential Storage
 * Handles encrypted storage of sensitive authentication data
 * Implements multiple security layers and audit logging
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SecureCredentialStorage {
    constructor(config = {}) {
        this.config = {
            storageDir: config.storageDir || path.join(process.cwd(), '.secure'),
            tokenFile: 'clickup_token.enc',
            credentialsFile: 'master_credentials.enc',
            auditFile: 'auth_audit.log',
            encryptionAlgorithm: 'aes-256-gcm',
            keyDerivation: 'pbkdf2',
            keyIterations: 100000,
            ...config
        };
        
        this.logger = config.logger || console;
        this.encryptionKey = null;
        this.isInitialized = false;
    }

    /**
     * Initialize secure storage system
     */
    async initialize() {
        try {
            this.logger.log('🔐 Initializing Secure Credential Storage...');
            
            // Ensure storage directory exists
            await this.ensureStorageDirectory();
            
            // Initialize encryption key
            await this.initializeEncryptionKey();
            
            // Setup audit logging
            await this.initializeAuditLog();
            
            this.isInitialized = true;
            this.logger.log('✅ Secure Credential Storage initialized');
            
            await this.auditLog('STORAGE_INITIALIZED', { timestamp: new Date() });
            
            return { success: true, message: 'Secure storage initialized' };
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Secure Credential Storage:', error);
            throw error;
        }
    }

    /**
     * Store ClickUp token securely
     */
    async storeToken(tokenData) {
        this.ensureInitialized();
        
        try {
            this.logger.log('🔐 Storing ClickUp token securely...');
            
            // Add metadata
            const tokenWithMetadata = {
                ...tokenData,
                storedAt: new Date().toISOString(),
                storageVersion: '1.0',
                lastAccessed: new Date().toISOString()
            };
            
            // Encrypt token data
            const encryptedData = await this.encryptData(JSON.stringify(tokenWithMetadata));
            
            // Store encrypted data
            const tokenFilePath = path.join(this.config.storageDir, this.config.tokenFile);
            await fs.writeFile(tokenFilePath, encryptedData);
            
            // Set secure file permissions
            await fs.chmod(tokenFilePath, 0o600);
            
            await this.auditLog('TOKEN_STORED', { 
                userEmail: tokenData.userEmail,
                refreshMethod: tokenData.refreshMethod,
                timestamp: new Date()
            });
            
            this.logger.log('✅ ClickUp token stored securely');
            
            return { success: true, message: 'Token stored securely' };
            
        } catch (error) {
            this.logger.error('❌ Failed to store token:', error);
            await this.auditLog('TOKEN_STORE_FAILED', { error: error.message, timestamp: new Date() });
            throw error;
        }
    }

    /**
     * Retrieve stored ClickUp token
     */
    async getStoredToken() {
        this.ensureInitialized();
        
        try {
            const tokenFilePath = path.join(this.config.storageDir, this.config.tokenFile);
            
            // Check if token file exists
            try {
                await fs.access(tokenFilePath);
            } catch {
                this.logger.warn('⚠️ No stored token found');
                return null;
            }
            
            // Read encrypted data
            const encryptedData = await fs.readFile(tokenFilePath);
            
            // Decrypt token data
            const decryptedData = await this.decryptData(encryptedData);
            const tokenData = JSON.parse(decryptedData);
            
            // Update last accessed
            tokenData.lastAccessed = new Date().toISOString();
            await this.storeToken(tokenData);
            
            await this.auditLog('TOKEN_ACCESSED', { 
                userEmail: tokenData.userEmail,
                timestamp: new Date()
            });
            
            this.logger.log('✅ ClickUp token retrieved successfully');
            
            return tokenData;
            
        } catch (error) {
            this.logger.error('❌ Failed to retrieve stored token:', error);
            await this.auditLog('TOKEN_ACCESS_FAILED', { error: error.message, timestamp: new Date() });
            throw error;
        }
    }

    /**
     * Store master user credentials securely (for automated OAuth)
     */
    async storeCredentials(credentials) {
        this.ensureInitialized();
        
        try {
            this.logger.log('🔐 Storing master credentials securely...');
            
            // Add metadata and security flags
            const credentialsWithMetadata = {
                email: credentials.email,
                // Note: We don't store password, only OAuth refresh data
                oauthRefreshToken: credentials.oauthRefreshToken,
                clientId: credentials.clientId,
                storedAt: new Date().toISOString(),
                storageVersion: '1.0',
                securityLevel: 'high',
                autoRefreshEnabled: true
            };
            
            // Encrypt credentials
            const encryptedData = await this.encryptData(JSON.stringify(credentialsWithMetadata));
            
            // Store encrypted data
            const credentialsFilePath = path.join(this.config.storageDir, this.config.credentialsFile);
            await fs.writeFile(credentialsFilePath, encryptedData);
            
            // Set secure file permissions
            await fs.chmod(credentialsFilePath, 0o600);
            
            await this.auditLog('CREDENTIALS_STORED', { 
                email: credentials.email,
                timestamp: new Date()
            });
            
            this.logger.log('✅ Master credentials stored securely');
            
            return { success: true, message: 'Credentials stored securely' };
            
        } catch (error) {
            this.logger.error('❌ Failed to store credentials:', error);
            await this.auditLog('CREDENTIALS_STORE_FAILED', { error: error.message, timestamp: new Date() });
            throw error;
        }
    }

    /**
     * Retrieve stored master credentials
     */
    async getStoredCredentials() {
        this.ensureInitialized();
        
        try {
            const credentialsFilePath = path.join(this.config.storageDir, this.config.credentialsFile);
            
            // Check if credentials file exists
            try {
                await fs.access(credentialsFilePath);
            } catch {
                this.logger.warn('⚠️ No stored credentials found');
                return null;
            }
            
            // Read encrypted data
            const encryptedData = await fs.readFile(credentialsFilePath);
            
            // Decrypt credentials
            const decryptedData = await this.decryptData(encryptedData);
            const credentials = JSON.parse(decryptedData);
            
            await this.auditLog('CREDENTIALS_ACCESSED', { 
                email: credentials.email,
                timestamp: new Date()
            });
            
            this.logger.log('✅ Master credentials retrieved successfully');
            
            return credentials;
            
        } catch (error) {
            this.logger.error('❌ Failed to retrieve stored credentials:', error);
            await this.auditLog('CREDENTIALS_ACCESS_FAILED', { error: error.message, timestamp: new Date() });
            throw error;
        }
    }

    /**
     * Encrypt data using AES-256-CBC (Node.js compatible)
     */
    async encryptData(plaintext) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey.toString('hex'));
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Combine IV and encrypted data
        const combined = Buffer.concat([
            iv,
            Buffer.from(encrypted, 'hex')
        ]);
        
        return combined.toString('base64');
    }

    /**
     * Decrypt data using AES-256-CBC (Node.js compatible)
     */
    async decryptData(encryptedData) {
        const combined = Buffer.from(encryptedData, 'base64');
        
        // Extract IV and encrypted data
        const iv = combined.subarray(0, 16);
        const encrypted = combined.subarray(16);
        
        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey.toString('hex'));
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Initialize encryption key from environment or generate
     */
    async initializeEncryptionKey() {
        // Try to get key from environment
        const envKey = process.env.TASKFLOW_ENCRYPTION_KEY;
        
        if (envKey) {
            this.encryptionKey = crypto.pbkdf2Sync(
                envKey,
                'taskflow-auth-salt',
                this.config.keyIterations,
                32,
                'sha256'
            );
            this.logger.log('🔑 Using encryption key from environment');
        } else {
            // Generate key from server-specific data
            const keyMaterial = require('os').hostname() + process.env.DB_PASSWORD + 'taskflow-secure';
            this.encryptionKey = crypto.pbkdf2Sync(
                keyMaterial,
                'taskflow-server-salt',
                this.config.keyIterations,
                32,
                'sha256'
            );
            this.logger.log('🔑 Generated encryption key from server data');
        }
    }

    /**
     * Ensure storage directory exists
     */
    async ensureStorageDirectory() {
        try {
            await fs.mkdir(this.config.storageDir, { recursive: true, mode: 0o700 });
            this.logger.log(`📁 Storage directory ensured: ${this.config.storageDir}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Initialize audit logging
     */
    async initializeAuditLog() {
        const auditFilePath = path.join(this.config.storageDir, this.config.auditFile);
        
        // Create audit file if it doesn't exist
        try {
            await fs.access(auditFilePath);
        } catch {
            await fs.writeFile(auditFilePath, '');
            await fs.chmod(auditFilePath, 0o600);
        }
        
        this.logger.log('📝 Audit logging initialized');
    }

    /**
     * Log security-related events
     */
    async auditLog(event, data = {}) {
        try {
            const auditEntry = {
                timestamp: new Date().toISOString(),
                event: event,
                process: process.pid,
                ...data
            };
            
            const auditFilePath = path.join(this.config.storageDir, this.config.auditFile);
            const logLine = JSON.stringify(auditEntry) + '\n';
            
            await fs.appendFile(auditFilePath, logLine);
            
        } catch (error) {
            this.logger.error('❌ Failed to write audit log:', error);
        }
    }

    /**
     * Get recent audit logs
     */
    async getAuditLogs(lines = 50) {
        this.ensureInitialized();
        
        try {
            const auditFilePath = path.join(this.config.storageDir, this.config.auditFile);
            const content = await fs.readFile(auditFilePath, 'utf8');
            
            const logLines = content.trim().split('\n').filter(line => line);
            const recentLines = logLines.slice(-lines);
            
            return recentLines.map(line => JSON.parse(line));
            
        } catch (error) {
            this.logger.error('❌ Failed to read audit logs:', error);
            return [];
        }
    }

    /**
     * Clear stored credentials (emergency use)
     */
    async clearStoredData() {
        this.ensureInitialized();
        
        try {
            this.logger.warn('🗑️ Clearing all stored credential data...');
            
            const tokenFilePath = path.join(this.config.storageDir, this.config.tokenFile);
            const credentialsFilePath = path.join(this.config.storageDir, this.config.credentialsFile);
            
            // Remove token file
            try {
                await fs.unlink(tokenFilePath);
                this.logger.log('✅ Token file cleared');
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            
            // Remove credentials file
            try {
                await fs.unlink(credentialsFilePath);
                this.logger.log('✅ Credentials file cleared');
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            
            await this.auditLog('STORAGE_CLEARED', { 
                reason: 'manual_clear',
                timestamp: new Date()
            });
            
            return { success: true, message: 'All stored data cleared' };
            
        } catch (error) {
            this.logger.error('❌ Failed to clear stored data:', error);
            throw error;
        }
    }

    /**
     * Ensure storage is initialized
     */
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('SecureCredentialStorage not initialized. Call initialize() first.');
        }
    }

    /**
     * Get storage status
     */
    async getStatus() {
        this.ensureInitialized();
        
        try {
            const tokenFilePath = path.join(this.config.storageDir, this.config.tokenFile);
            const credentialsFilePath = path.join(this.config.storageDir, this.config.credentialsFile);
            
            const hasToken = await fs.access(tokenFilePath).then(() => true).catch(() => false);
            const hasCredentials = await fs.access(credentialsFilePath).then(() => true).catch(() => false);
            
            const auditLogs = await this.getAuditLogs(10);
            
            return {
                isInitialized: this.isInitialized,
                hasStoredToken: hasToken,
                hasStoredCredentials: hasCredentials,
                storageDirectory: this.config.storageDir,
                recentAuditEvents: auditLogs.length,
                lastAuditEvent: auditLogs[auditLogs.length - 1] || null
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to get storage status:', error);
            throw error;
        }
    }
}

module.exports = { SecureCredentialStorage };