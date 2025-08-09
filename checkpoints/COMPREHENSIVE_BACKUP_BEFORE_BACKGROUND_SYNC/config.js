const { Pool } = require('pg');

// Database configuration with environment variables
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'taskflow_auth',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    
    // Connection pool settings
    max: 10, // Maximum number of clients in pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait when connecting to database
    
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Connection error handling
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Database helper functions
class Database {
    static async query(text, params) {
        const start = Date.now();
        try {
            const res = await pool.query(text, params);
            const duration = Date.now() - start;
            console.log('Executed query', { text, duration, rows: res.rowCount });
            return res;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }
    
    static async getClient() {
        return await pool.connect();
    }
    
    static async transaction(callback) {
        const client = await pool.connect();
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
    
    static async healthCheck() {
        try {
            const result = await pool.query('SELECT NOW()');
            return {
                status: 'healthy',
                timestamp: result.rows[0].now,
                pool: {
                    totalCount: pool.totalCount,
                    idleCount: pool.idleCount,
                    waitingCount: pool.waitingCount
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
    
    static async close() {
        await pool.end();
    }
}

module.exports = {
    pool,
    Database,
    dbConfig
};