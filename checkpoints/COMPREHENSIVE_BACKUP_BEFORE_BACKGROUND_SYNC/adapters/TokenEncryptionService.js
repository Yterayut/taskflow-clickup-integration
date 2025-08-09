/**
 * Token Encryption Service
 * Handles AES-256 encryption/decryption for ClickUp tokens
 * 
 * SECURITY CRITICAL: Encrypts tokens at rest to prevent data breaches
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class TokenEncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits
        this.saltLength = 32; // 256 bits
        
        // Initialize encryption key
        this.encryptionKey = null;
        this.initialized = false;
    }
    
    /**
     * Initialize encryption service with secure key management
     */
    async initialize() {
        try {
            if (this.initialized) {
                return;
            }
            
            // Try to load existing key, or generate new one
            const keyPath = path.join(process.cwd(), '.secure', 'encryption.key');
            
            try {
                // Ensure .secure directory exists
                await fs.mkdir(path.dirname(keyPath), { recursive: true, mode: 0o700 });
                
                // Try to load existing key
                const keyData = await fs.readFile(keyPath);
                this.encryptionKey = keyData;
                
                console.log('🔐 Token encryption key loaded successfully');
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Generate new key if doesn't exist
                    console.log('🔐 Generating new token encryption key...');
                    this.encryptionKey = crypto.randomBytes(this.keyLength);
                    
                    // Save key securely
                    await fs.writeFile(keyPath, this.encryptionKey, { mode: 0o600 });
                    console.log('🔐 New encryption key generated and saved');
                } else {
                    throw error;
                }
            }
            
            this.initialized = true;
            console.log('✅ TokenEncryptionService initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize TokenEncryptionService:', error);
            throw new Error('Critical security initialization failed');
        }
    }
    
    /**
     * Encrypt token with AES-256-GCM
     * Returns base64 encoded encrypted data with IV and auth tag
     */
    async encryptToken(token) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (!token || typeof token !== 'string') {
            throw new Error('Token must be a non-empty string');
        }
        
        try {
            // Generate random IV for each encryption
            const iv = crypto.randomBytes(this.ivLength);
            
            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
            
            // Encrypt the token
            let encrypted = cipher.update(token, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            
            // Get authentication tag
            const authTag = cipher.getAuthTag();
            
            // Combine IV + auth tag + encrypted data
            const combined = Buffer.concat([
                iv,
                authTag,
                Buffer.from(encrypted, 'base64')
            ]);
            
            // Return base64 encoded result
            return combined.toString('base64');
            
        } catch (error) {
            console.error('❌ Token encryption failed:', error);
            throw new Error('Token encryption failed');
        }
    }
    
    /**
     * Decrypt token from encrypted base64 data
     */
    async decryptToken(encryptedData) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (!encryptedData || typeof encryptedData !== 'string') {
            throw new Error('Encrypted data must be a non-empty string');
        }
        
        try {
            // Decode base64 data
            const combined = Buffer.from(encryptedData, 'base64');
            
            // Extract components
            const iv = combined.subarray(0, this.ivLength);
            const authTag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
            const encrypted = combined.subarray(this.ivLength + this.tagLength);
            
            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
            decipher.setAuthTag(authTag);
            
            // Decrypt the token
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
            
        } catch (error) {
            console.error('❌ Token decryption failed:', error);
            throw new Error('Token decryption failed - data may be corrupted');
        }
    }
    
    /**
     * Check if data appears to be encrypted (base64 format)
     */
    isEncrypted(data) {
        if (!data || typeof data !== 'string') {
            return false;
        }
        
        try {
            // Check if it's valid base64 and has expected length
            const decoded = Buffer.from(data, 'base64');
            const expectedMinLength = this.ivLength + this.tagLength + 16; // IV + tag + min encrypted data
            
            return decoded.length >= expectedMinLength && 
                   Buffer.from(decoded.toString('base64'), 'base64').equals(decoded);
        } catch {
            return false;
        }
    }
    
    /**
     * Migrate existing plain text tokens to encrypted format
     */
    async migrateTokenIfNeeded(token) {
        if (!token) {
            return null;
        }
        
        // If already encrypted, return as-is
        if (this.isEncrypted(token)) {
            return token;
        }
        
        // If plain text, encrypt it
        console.log('🔄 Migrating plain text token to encrypted format');
        return await this.encryptToken(token);
    }
    
    /**
     * Get token for use (decrypt if encrypted)
     */
    async getDecryptedToken(tokenData) {
        if (!tokenData) {
            return null;
        }
        
        // If already plain text (during migration), return as-is
        if (!this.isEncrypted(tokenData)) {
            console.warn('⚠️  Found unencrypted token - should be migrated');
            return tokenData;
        }
        
        try {
            // Decrypt encrypted token
            return await this.decryptToken(tokenData);
        } catch (error) {
            console.error('❌ Failed to decrypt token, treating as plain text:', error.message);
            
            // Fallback: treat as plain text if decryption fails
            // This handles migration scenarios and corrupted encrypted data
            if (typeof tokenData === 'string' && tokenData.length > 0) {
                console.warn('⚠️  Failed to decrypt token, might be plain text during migration');
                return tokenData;
            }
            
            // If all else fails, return null
            console.error('❌ Token is neither valid encrypted data nor plain text');
            return null;
        }
    }
    
    /**
     * Health check for encryption service
     */
    async healthCheck() {
        try {
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Test encryption/decryption cycle
            const testData = 'test_token_' + Date.now();
            const encrypted = await this.encryptToken(testData);
            const decrypted = await this.decryptToken(encrypted);
            
            if (decrypted !== testData) {
                throw new Error('Encryption/decryption cycle failed');
            }
            
            return {
                status: 'healthy',
                algorithm: this.algorithm,
                keyLength: this.keyLength,
                initialized: this.initialized
            };
            
        } catch (error) {
            console.error('❌ TokenEncryptionService health check failed:', error);
            throw error;
        }
    }
    
    /**
     * Get encryption statistics
     */
    getStatistics() {
        return {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            ivLength: this.ivLength,
            tagLength: this.tagLength,
            initialized: this.initialized,
            secureKeyPath: path.join(process.cwd(), '.secure', 'encryption.key')
        };
    }
}

// Singleton instance for application-wide use
const tokenEncryptionService = new TokenEncryptionService();

module.exports = { 
    TokenEncryptionService,
    tokenEncryptionService
};