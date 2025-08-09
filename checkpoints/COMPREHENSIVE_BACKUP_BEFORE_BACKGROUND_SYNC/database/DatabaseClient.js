/**
 * Database Client
 * PostgreSQL connection and query management
 */
const { Pool } = require('pg');

class DatabaseClient {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }
    
    /**
     * Initialize database connection
     */
    async connect() {
        try {
            this.pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                database: process.env.DB_NAME || 'taskflow_pro',
                user: process.env.DB_USER || 'taskflow_user',
                password: process.env.DB_PASSWORD,
                ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
                max: 20, // Maximum number of clients in the pool
                idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
                connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
            });
            
            // Test connection
            await this.pool.query('SELECT NOW()');
            this.isConnected = true;
            
            console.log('✅ Database connected successfully');
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Execute a query
     */
    async query(text, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        
        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            // Log slow queries (> 1000ms)
            if (duration > 1000) {
                console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
            }
            
            return result;
        } catch (error) {
            console.error('Database query error:', {
                query: text.substring(0, 100),
                params: params,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Execute a transaction
     */
    async transaction(callback) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        try {
            const result = await this.query('SELECT 1 as health_check');
            return result.rows[0].health_check === 1;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Close database connection
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('Database connection closed');
        }
    }
    
    /**
     * Get connection pool stats
     */
    getStats() {
        if (!this.pool) {
            return null;
        }
        
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        };
    }
}

// Singleton instance
let dbClient = null;

function getDatabase() {
    if (!dbClient) {
        dbClient = new DatabaseClient();
    }
    return dbClient;
}

module.exports = { DatabaseClient, getDatabase };