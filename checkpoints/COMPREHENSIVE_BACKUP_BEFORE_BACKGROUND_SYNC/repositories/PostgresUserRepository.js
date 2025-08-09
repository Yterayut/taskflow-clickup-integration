/**
 * PostgreSQL User Repository
 * Implements user data persistence
 */
const { User } = require('../../domain/entities/User');

class PostgresUserRepository {
    constructor(dbClient) {
        this.db = dbClient;
    }
    
    /**
     * Find user by email
     */
    async findByEmail(email) {
        try {
            const result = await this.db.query(
                'SELECT * FROM users WHERE email = $1 AND is_active = true',
                [email.toLowerCase()]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return User.fromDatabaseRow(result.rows[0]);
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }
    
    /**
     * Find user by ID
     */
    async findById(userId) {
        try {
            const result = await this.db.query(
                'SELECT * FROM users WHERE id = $1 AND is_active = true',
                [userId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return User.fromDatabaseRow(result.rows[0]);
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }
    
    /**
     * Save user (update existing user)
     */
    async save(user) {
        try {
            const dbObject = user.toDatabaseObject();
            
            const result = await this.db.query(`
                UPDATE users 
                SET 
                    email = $2,
                    password_hash = $3,
                    role = $4,
                    full_name = $5,
                    last_login = $6,
                    is_active = $7,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `, [
                dbObject.id,
                dbObject.email,
                dbObject.password_hash,
                dbObject.role,
                dbObject.full_name,
                dbObject.last_login,
                dbObject.is_active
            ]);
            
            if (result.rows.length === 0) {
                throw new Error('User not found for update');
            }
            
            return User.fromDatabaseRow(result.rows[0]);
        } catch (error) {
            console.error('Error saving user:', error);
            throw error;
        }
    }
    
    /**
     * Create new user
     */
    async create(user) {
        try {
            const dbObject = user.toDatabaseObject();
            
            const result = await this.db.query(`
                INSERT INTO users (
                    email, password_hash, role, full_name, 
                    last_login, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                RETURNING *
            `, [
                dbObject.email,
                dbObject.password_hash,
                dbObject.role,
                dbObject.full_name,
                dbObject.last_login,
                dbObject.is_active
            ]);
            
            return User.fromDatabaseRow(result.rows[0]);
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }
    
    /**
     * Find all users (admin function)
     */
    async findAll(options = {}) {
        try {
            const { 
                includeInactive = false, 
                role = null, 
                limit = 50, 
                offset = 0 
            } = options;
            
            let query = 'SELECT * FROM users';
            const params = [];
            const conditions = [];
            
            if (!includeInactive) {
                conditions.push('is_active = true');
            }
            
            if (role) {
                conditions.push(`role = $${params.length + 1}`);
                params.push(role);
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);
            
            const result = await this.db.query(query, params);
            
            return result.rows.map(row => User.fromDatabaseRow(row));
        } catch (error) {
            console.error('Error finding all users:', error);
            throw error;
        }
    }
    
    /**
     * Count users
     */
    async count(options = {}) {
        try {
            const { includeInactive = false, role = null } = options;
            
            let query = 'SELECT COUNT(*) as total FROM users';
            const params = [];
            const conditions = [];
            
            if (!includeInactive) {
                conditions.push('is_active = true');
            }
            
            if (role) {
                conditions.push(`role = $${params.length + 1}`);
                params.push(role);
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            const result = await this.db.query(query, params);
            return parseInt(result.rows[0].total);
        } catch (error) {
            console.error('Error counting users:', error);
            throw error;
        }
    }
    
    /**
     * Delete user (soft delete)
     */
    async delete(userId) {
        try {
            const result = await this.db.query(
                'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
                [userId]
            );
            
            return result.rows.length > 0;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
    
    /**
     * Get last successful login across all users
     */
    async getLastSuccessfulLogin() {
        try {
            const result = await this.db.query(
                'SELECT last_login FROM users WHERE last_login IS NOT NULL ORDER BY last_login DESC LIMIT 1'
            );
            
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            console.error('Error getting last successful login:', error);
            return null;
        }
    }
    
    /**
     * Health check for database connectivity
     */
    async healthCheck() {
        try {
            await this.db.query('SELECT 1');
            return true;
        } catch (error) {
            throw new Error('Database health check failed');
        }
    }
    
    /**
     * Get user statistics
     */
    async getStatistics() {
        try {
            const result = await this.db.query(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN role = 'master' THEN 1 END) as master_users,
                    COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
                    COUNT(CASE WHEN last_login > NOW() - INTERVAL '30 days' THEN 1 END) as active_last_30_days
                FROM users
            `);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error getting user statistics:', error);
            throw error;
        }
    }
}

module.exports = { PostgresUserRepository };