/**
 * PostgreSQL ClickUp Token Repository
 * Implements ClickUp token data persistence with AES-256 encryption
 */
const { ClickUpToken } = require('../../domain/entities/ClickUpToken');
const { tokenEncryptionService } = require('../adapters/TokenEncryptionService');

class PostgresClickUpTokenRepository {
    constructor(dbClient) {
        this.db = dbClient;
        this.encryptionService = tokenEncryptionService;
    }
    
    /**
     * Encrypt tokens in database object before storage
     */
    async encryptTokenData(dbObject) {
        const encrypted = { ...dbObject };
        
        if (encrypted.access_token) {
            encrypted.access_token = await this.encryptionService.encryptToken(encrypted.access_token);
        }
        
        if (encrypted.refresh_token) {
            encrypted.refresh_token = await this.encryptionService.encryptToken(encrypted.refresh_token);
        }
        
        return encrypted;
    }
    
    /**
     * Decrypt tokens in database row after retrieval
     */
    async decryptTokenRow(row) {
        const decrypted = { ...row };
        
        if (decrypted.access_token) {
            try {
                decrypted.access_token = await this.encryptionService.getDecryptedToken(decrypted.access_token);
            } catch (error) {
                console.warn('⚠️  Failed to decrypt access_token, might be plain text during migration');
                // Keep original token during migration period
            }
        }
        
        if (decrypted.refresh_token) {
            try {
                decrypted.refresh_token = await this.encryptionService.getDecryptedToken(decrypted.refresh_token);
            } catch (error) {
                console.warn('⚠️  Failed to decrypt refresh_token, might be plain text during migration');
                // Keep original token during migration period
            }
        }
        
        return decrypted;
    }
    
    /**
     * Find master user's ClickUp token
     */
    async findMasterToken() {
        try {
            const result = await this.db.query(`
                SELECT ct.* FROM clickup_tokens ct
                JOIN users u ON ct.user_id = u.id
                WHERE u.email = $1 AND u.role = 'master'
                ORDER BY ct.created_at DESC
                LIMIT 1
            `, [process.env.MASTER_USER_EMAIL?.toLowerCase()]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            // Decrypt tokens before returning
            const decryptedRow = await this.decryptTokenRow(result.rows[0]);
            return ClickUpToken.fromDatabaseRow(decryptedRow);
        } catch (error) {
            console.error('Error finding master token:', error);
            throw error;
        }
    }
    
    /**
     * Find token by user ID
     */
    async findByUserId(userId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM clickup_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            // Decrypt tokens before returning
            const decryptedRow = await this.decryptTokenRow(result.rows[0]);
            return ClickUpToken.fromDatabaseRow(decryptedRow);
        } catch (error) {
            console.error('Error finding token by user ID:', error);
            throw error;
        }
    }

    /**
     * Find active tokens by user ID (for compatibility)
     */
    async findActiveTokensByUser(userId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM clickup_tokens WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            );
            
            return result.rows.map(row => ClickUpToken.fromDatabaseRow(row));
        } catch (error) {
            console.error('Error finding active tokens by user:', error);
            throw error;
        }
    }
    
    /**
     * Save ClickUp token (insert or update) with encryption
     */
    async save(token) {
        try {
            const dbObject = token.toDatabaseObject();
            
            // 🔐 SECURITY: Encrypt tokens before storing
            const encryptedData = await this.encryptTokenData(dbObject);
            
            // Check if token exists for this user
            const existingResult = await this.db.query(
                'SELECT id FROM clickup_tokens WHERE user_id = $1',
                [token.userId]
            );
            
            if (existingResult.rows.length > 0) {
                // Update existing token
                const result = await this.db.query(`
                    UPDATE clickup_tokens 
                    SET 
                        access_token = $2,
                        refresh_token = $3,
                        expires_at = $4,
                        scope = $5,
                        token_type = $6,
                        last_refresh_attempt = $7,
                        refresh_attempts_count = $8,
                        updated_at = NOW()
                    WHERE user_id = $1
                    RETURNING *
                `, [
                    encryptedData.user_id,
                    encryptedData.access_token,
                    encryptedData.refresh_token,
                    encryptedData.expires_at,
                    encryptedData.scope,
                    encryptedData.token_type,
                    encryptedData.last_refresh_attempt,
                    encryptedData.refresh_attempts_count
                ]);
                
                // Decrypt before returning
                const decryptedRow = await this.decryptTokenRow(result.rows[0]);
                return ClickUpToken.fromDatabaseRow(decryptedRow);
            } else {
                // Insert new token
                const result = await this.db.query(`
                    INSERT INTO clickup_tokens (
                        user_id, access_token, refresh_token, expires_at,
                        scope, token_type, last_refresh_attempt, refresh_attempts_count,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                    RETURNING *
                `, [
                    encryptedData.user_id,
                    encryptedData.access_token,
                    encryptedData.refresh_token,
                    encryptedData.expires_at,
                    encryptedData.scope,
                    encryptedData.token_type,
                    encryptedData.last_refresh_attempt,
                    encryptedData.refresh_attempts_count
                ]);
                
                // Decrypt before returning
                const decryptedRow = await this.decryptTokenRow(result.rows[0]);
                return ClickUpToken.fromDatabaseRow(decryptedRow);
            }
        } catch (error) {
            console.error('Error saving ClickUp token:', error);
            throw error;
        }
    }
    
    /**
     * Store permanent token for master user (OAuth setup)
     */
    async storePermanent(tokenEntity) {
        try {
            const dbObject = tokenEntity.toDatabaseObject();
            
            // Check if permanent token already exists for this user
            const existingResult = await this.db.query(
                'SELECT id FROM clickup_tokens WHERE user_id = $1 AND is_permanent = true',
                [dbObject.user_id]
            );
            
            if (existingResult.rows.length > 0) {
                // Update existing permanent token
                const result = await this.db.query(`
                    UPDATE clickup_tokens SET
                        access_token = $2,
                        refresh_token = $3,
                        expires_at = $4,
                        scope = $5,
                        token_type = $6,
                        is_permanent = $7,
                        setup_completed_at = $8,
                        updated_at = NOW()
                    WHERE user_id = $1 AND is_permanent = true
                    RETURNING *
                `, [
                    dbObject.user_id,
                    dbObject.access_token,
                    dbObject.refresh_token,
                    dbObject.expires_at,
                    dbObject.scope,
                    dbObject.token_type,
                    dbObject.is_permanent,
                    dbObject.setup_completed_at
                ]);
                
                return ClickUpToken.fromDatabaseRow(result.rows[0]);
            } else {
                // Insert new permanent token
                const result = await this.db.query(`
                    INSERT INTO clickup_tokens (
                        user_id, access_token, refresh_token, expires_at,
                        scope, token_type, is_permanent, setup_completed_at,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                    RETURNING *
                `, [
                    dbObject.user_id,
                    dbObject.access_token,
                    dbObject.refresh_token,
                    dbObject.expires_at,
                    dbObject.scope,
                    dbObject.token_type,
                    dbObject.is_permanent,
                    dbObject.setup_completed_at
                ]);
                
                return ClickUpToken.fromDatabaseRow(result.rows[0]);
            }
        } catch (error) {
            console.error('Error storing permanent ClickUp token:', error);
            throw error;
        }
    }

    /**
     * Find permanent token for master user
     */
    async findPermanentToken(userId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM clickup_tokens WHERE user_id = $1 AND is_permanent = true ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return ClickUpToken.fromDatabaseRow(result.rows[0]);
        } catch (error) {
            console.error('Error finding permanent token:', error);
            throw error;
        }
    }

    /**
     * Delete token by user ID
     */
    async deleteByUserId(userId) {
        try {
            const result = await this.db.query(
                'DELETE FROM clickup_tokens WHERE user_id = $1',
                [userId]
            );
            
            return result.rowCount > 0;
        } catch (error) {
            console.error('Error deleting ClickUp token:', error);
            throw error;
        }
    }
    
    /**
     * Find all tokens (admin function)
     */
    async findAll(options = {}) {
        try {
            const { includeExpired = false, limit = 50, offset = 0 } = options;
            
            let query = `
                SELECT ct.*, u.email as user_email, u.role as user_role
                FROM clickup_tokens ct
                JOIN users u ON ct.user_id = u.id
            `;
            const params = [];
            
            if (!includeExpired) {
                query += ' WHERE ct.expires_at > NOW()';
            }
            
            query += ` ORDER BY ct.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
            
            const result = await this.db.query(query, params);
            
            return result.rows.map(row => ({
                token: ClickUpToken.fromDatabaseRow(row),
                userEmail: row.user_email,
                userRole: row.user_role
            }));
        } catch (error) {
            console.error('Error finding all tokens:', error);
            throw error;
        }
    }
    
    /**
     * Get token statistics
     */
    async getStatistics() {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_tokens,
                    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as valid_tokens,
                    COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_tokens,
                    COUNT(CASE WHEN refresh_token IS NOT NULL THEN 1 END) as tokens_with_refresh,
                    AVG(refresh_attempts_count) as avg_refresh_attempts,
                    MAX(expires_at) as latest_expiry,
                    MIN(expires_at) as earliest_expiry
                FROM clickup_tokens
            `);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error getting token statistics:', error);
            throw error;
        }
    }
    
    /**
     * Clean up expired tokens (maintenance)
     */
    async cleanupExpiredTokens(gracePeriodDays = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);
            
            const result = await this.db.query(
                'DELETE FROM clickup_tokens WHERE expires_at < $1 AND refresh_token IS NULL',
                [cutoffDate]
            );
            
            return result.rowCount;
        } catch (error) {
            console.error('Error cleaning up expired tokens:', error);
            throw error;
        }
    }
    
    /**
     * Get tokens expiring soon
     */
    async getTokensExpiringSoon(hoursAhead = 24) {
        try {
            const thresholdDate = new Date();
            thresholdDate.setHours(thresholdDate.getHours() + hoursAhead);
            
            const result = await this.db.query(`
                SELECT ct.*, u.email as user_email
                FROM clickup_tokens ct
                JOIN users u ON ct.user_id = u.id
                WHERE ct.expires_at BETWEEN NOW() AND $1
                ORDER BY ct.expires_at ASC
            `, [thresholdDate]);
            
            return result.rows.map(row => ({
                token: ClickUpToken.fromDatabaseRow(row),
                userEmail: row.user_email
            }));
        } catch (error) {
            console.error('Error getting tokens expiring soon:', error);
            throw error;
        }
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        try {
            await this.db.query('SELECT 1 FROM clickup_tokens LIMIT 1');
            return true;
        } catch (error) {
            throw new Error('ClickUp tokens table health check failed');
        }
    }
}

module.exports = { PostgresClickUpTokenRepository };