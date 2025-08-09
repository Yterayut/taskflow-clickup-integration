// Test Database Setup and Management
require('dotenv').config({ path: '.env.test' });

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Test database configuration
const testDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'taskflow_pro_test',
    user: process.env.DB_USER || 'taskflow_user',
    password: process.env.DB_PASSWORD || 'TaskFlow2025Secure',
};

let testPool;

// Setup test database
async function setupTestDatabase() {
    try {
        console.log('🔧 Setting up test database...');
        
        // Connect to postgres to check/create test database
        const adminPool = new Pool({
            ...testDbConfig,
            database: 'postgres'
        });
        
        try {
            // Create test database if it doesn't exist
            await adminPool.query(`CREATE DATABASE ${testDbConfig.database}`);
            console.log(`✅ Test database ${testDbConfig.database} created`);
        } catch (error) {
            if (error.code === '42P04') {
                console.log(`ℹ️ Test database ${testDbConfig.database} already exists`);
            } else {
                throw error;
            }
        } finally {
            await adminPool.end();
        }
        
        // Connect to test database
        testPool = new Pool(testDbConfig);
        
        // Create schema
        await testPool.query(`
            DROP TABLE IF EXISTS clickup_tokens CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'employee',
                full_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
            
            CREATE TABLE clickup_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at TIMESTAMP,
                token_type VARCHAR(50) DEFAULT 'Bearer',
                scope TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_users_email ON users(email);
            CREATE INDEX idx_users_role ON users(role);
            CREATE INDEX idx_clickup_tokens_user_id ON clickup_tokens(user_id);
            CREATE INDEX idx_clickup_tokens_expires_at ON clickup_tokens(expires_at);
            
            ALTER TABLE users ADD CONSTRAINT chk_user_role 
            CHECK (role IN ('master', 'manager', 'team_lead', 'employee'));
            
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            
            CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
            CREATE TRIGGER update_clickup_tokens_updated_at BEFORE UPDATE ON clickup_tokens
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);
        
        console.log('✅ Test database schema created');
        
        // Seed test users
        const testPasswordHash = await bcrypt.hash('testpass123', parseInt(process.env.BCRYPT_SALT_ROUNDS) || 4);
        
        await testPool.query(`
            INSERT INTO users (email, password_hash, role, full_name) VALUES
            ('test.master@example.com', $1, 'master', 'Test Master User'),
            ('test.manager@example.com', $1, 'manager', 'Test Manager User'),
            ('test.teamlead@example.com', $1, 'team_lead', 'Test Team Lead User'),
            ('test.employee@example.com', $1, 'employee', 'Test Employee User'),
            ('inactive.user@example.com', $1, 'employee', 'Inactive Test User'),
            ('another.employee@example.com', $1, 'employee', 'Another Employee'),
            ('special.chars@test-domain.co.uk', $1, 'employee', 'Special Chars User');
        `, [testPasswordHash]);
        
        // Make one user inactive for testing
        await testPool.query(`
            UPDATE users SET is_active = false WHERE email = 'inactive.user@example.com'
        `);
        
        // Add some test ClickUp tokens
        const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
        const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
        
        await testPool.query(`
            INSERT INTO clickup_tokens (user_id, access_token, refresh_token, expires_at) 
            SELECT id, 'test_access_token_' || id, 'test_refresh_token_' || id, $1
            FROM users WHERE email = 'test.master@example.com'
        `, [futureDate]);
        
        await testPool.query(`
            INSERT INTO clickup_tokens (user_id, access_token, refresh_token, expires_at) 
            SELECT id, 'expired_token_' || id, 'expired_refresh_' || id, $1
            FROM users WHERE email = 'test.employee@example.com'
        `, [pastDate]);
        
        console.log('✅ Test users and tokens seeded');
        
        // Verify setup
        const userCount = await testPool.query('SELECT COUNT(*) FROM users');
        const tokenCount = await testPool.query('SELECT COUNT(*) FROM clickup_tokens');
        
        console.log(`✅ Test database ready: ${userCount.rows[0].count} users, ${tokenCount.rows[0].count} tokens`);
        
    } catch (error) {
        console.error('❌ Test database setup failed:', error);
        throw error;
    }
}

// Cleanup test database
async function cleanupTestDatabase() {
    try {
        if (testPool) {
            await testPool.end();
            console.log('✅ Test database connection closed');
        }
    } catch (error) {
        console.error('❌ Test database cleanup failed:', error);
    }
}

// Reset test data between tests
async function resetTestData() {
    try {
        if (!testPool) return;
        
        // Delete tokens but keep users
        await testPool.query('DELETE FROM clickup_tokens');
        
        // Reset user timestamps
        await testPool.query(`
            UPDATE users SET 
                last_login = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE email LIKE 'test.%' OR email LIKE '%.user@%'
        `);
        
        console.log('✅ Test data reset');
    } catch (error) {
        console.error('❌ Test data reset failed:', error);
        throw error;
    }
}

// Get test database pool
function getTestPool() {
    return testPool;
}

// Execute raw SQL for testing
async function executeTestSQL(sql, params = []) {
    if (!testPool) {
        throw new Error('Test database not initialized');
    }
    return await testPool.query(sql, params);
}

// Get user by email for testing
async function getTestUser(email) {
    if (!testPool) {
        throw new Error('Test database not initialized');
    }
    
    const result = await testPool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );
    
    return result.rows[0] || null;
}

// Create test ClickUp token
async function createTestClickUpToken(userEmail, accessToken = 'test_token', expiresIn = 3600) {
    if (!testPool) {
        throw new Error('Test database not initialized');
    }
    
    const user = await getTestUser(userEmail);
    if (!user) {
        throw new Error(`Test user ${userEmail} not found`);
    }
    
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    
    const result = await testPool.query(`
        INSERT INTO clickup_tokens (user_id, access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [user.id, accessToken, `refresh_${accessToken}`, expiresAt]);
    
    return result.rows[0];
}

module.exports = {
    setupTestDatabase,
    cleanupTestDatabase,
    resetTestData,
    getTestPool,
    executeTestSQL,
    getTestUser,
    createTestClickUpToken,
    testDbConfig
};